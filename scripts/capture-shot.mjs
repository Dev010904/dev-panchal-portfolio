/**
 * Captures a real screenshot of a live site and writes it into /public/work.
 *
 *   node scripts/capture-shot.mjs <url> <out-basename> [waitMs]
 *
 * Drives headless Chrome over the DevTools protocol rather than using
 * `--screenshot`. That flag captures as soon as the load event fires, or when
 * `--virtual-time-budget` runs out, and virtual time does not reliably advance
 * a site's own preloader — the first attempts at this all came back showing
 * the target site's loading spinner. Waiting in real time and then capturing
 * is slower and correct.
 *
 * Writes a WebP at the requested size plus the raw PNG for reference.
 *
 * `CAPTURE_EVAL` runs a snippet of JS in the page a moment before the shutter.
 * Some targets open onboarding over their own UI on a first visit, and a card
 * showing a modal is a screenshot of a modal, not of the work. Dismissing it is
 * part of getting a true capture, not staging one.
 */

import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR_BASE = path.join(ROOT, 'public');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const [, , url, name = 'shot', waitMsRaw = '9000', wRaw = '1440', hRaw = '900', dirRaw = 'work'] =
  process.argv;
if (!url) {
  console.error(
    'usage: node scripts/capture-shot.mjs <url> <out-basename> [waitMs] [width] [height] [outDir]',
  );
  process.exit(1);
}
const waitMs = Number(waitMsRaw);
const PORT = 9333;
const WIDTH = Number(wRaw);
const HEIGHT = Number(hRaw);
const SUBDIR = dirRaw;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findChrome() {
  const { access } = await import('node:fs/promises');
  for (const c of CHROME_CANDIDATES) {
    try {
      await access(c);
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error('Chrome not found. Add its path to CHROME_CANDIDATES.');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
}

const OUT_DIR = path.join(OUT_DIR_BASE, SUBDIR);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const chrome = await findChrome();

  const proc = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  try {
    // Wait for the debugging endpoint to come up.
    let version = null;
    for (let i = 0; i < 40 && !version; i++) {
      await sleep(250);
      try {
        version = await fetch(`http://127.0.0.1:${PORT}/json/version`).then((r) => r.json());
      } catch {
        /* not ready yet */
      }
    }
    if (!version) throw new Error('Chrome DevTools endpoint never came up.');

    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });

    const send = cdp(ws);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

    const sessionSend = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const raw = cdpSession(ws, sessionId);
        raw(method, params).then(resolve, reject);
      });

    // Flat-session messages need the sessionId on the envelope.
    let sid = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
    function cdpSession(socket, session) {
      return (method, params = {}) =>
        new Promise((resolve, reject) => {
          const msgId = 100000 + ++sid;
          pending.set(msgId, { resolve, reject });
          socket.send(JSON.stringify({ id: msgId, sessionId: session, method, params }));
        });
    }

    await sessionSend('Page.enable');
    await sessionSend('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await sessionSend('Page.navigate', { url });

    // Real time, not virtual: the target site's own preloader runs on real
    // timers and asset loads.
    await sleep(waitMs);

    if (process.env.CAPTURE_EVAL) {
      await sessionSend('Runtime.enable');
      const res = await sessionSend('Runtime.evaluate', {
        expression: process.env.CAPTURE_EVAL,
        awaitPromise: true,
        returnByValue: true,
      });
      console.log('eval ->', JSON.stringify(res.result?.value ?? res.exceptionDetails ?? null));
      // Let whatever the snippet dismissed finish animating out.
      await sleep(2500);
    }

    const { data } = await sessionSend('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });

    const png = Buffer.from(data, 'base64');

    // OG cards must be PNG at exact dimensions; project shots are WebP for
    // weight. Same capture path either way.
    const isOg = SUBDIR === 'brand';
    const outFile = path.join(OUT_DIR, `${name}.${isOg ? 'png' : 'webp'}`);

    const pipeline = sharp(png).resize(WIDTH, HEIGHT, { fit: 'cover', position: 'top' });
    await (isOg ? pipeline.png({ compressionLevel: 9 }) : pipeline.webp({ quality: 82 })).toFile(
      outFile,
    );

    console.log(`captured ${url} -> public/${SUBDIR}/${path.basename(outFile)}`);
    ws.close();
  } finally {
    proc.kill();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
