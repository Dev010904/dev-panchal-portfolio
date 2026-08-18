'use client';

import { TRACE } from '@/config/animation';

/**
 * THE VISITOR TRACE — the whole network surface.
 *
 * Four calls against one table over PostgREST, with `fetch`. There is
 * deliberately no `@supabase/supabase-js`: the SDK is ~50KB of auth, realtime
 * and query-builder for what is here two GETs and a POST, on a site whose
 * README opens with "nothing is downloaded".
 *
 * ── WHAT IS SENT ──────────────────────────────────────────────────────────
 *
 * A flat array of normalised floats and a random UUID. Nothing else. No IP is
 * recorded (Supabase does not log one into the row and the schema has nowhere
 * to put it), no user agent, no auth identity, no free text anywhere — a
 * stroke is geometry, so there is nothing to moderate and no way to write a
 * message into the shared space.
 *
 * `session_id` is minted per TAB and lives in `sessionStorage`, so it is gone
 * when the tab closes and identifies nobody. It exists for exactly one reason:
 * the table has a UNIQUE constraint on it, which is what enforces one stroke
 * per visitor per session at the database rather than on trust.
 *
 * ── WHEN SUPABASE IS UNREACHABLE ──────────────────────────────────────────
 *
 * Nothing is surfaced to the visitor. Ever. The structure renders from the
 * last cached set of strokes, submission goes quiet, and the section still
 * works as a thing to look at. A portfolio that displays a database error to a
 * recruiter has failed in a way that no amount of shader work makes up for.
 */

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** Configured at all? A missing env var must degrade, never throw. */
export const traceConfigured = Boolean(URL_BASE && KEY);

const TABLE = `${URL_BASE}/rest/v1/visitor_strokes`;
const CACHE_KEY = 'dp.trace.cache.v1';
const SESSION_KEY = 'dp.trace.session';
const SUBMITTED_KEY = 'dp.trace.submitted';

/** One stroke: a flat [x,y,z, x,y,z, …] in normalised -1..1 space. */
export type Stroke = number[];

function headers(): HeadersInit {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

/**
 * A v4 UUID, from the best source the browser offers.
 *
 * `session_id` is a `uuid` column, so this must be a real UUID and not merely
 * unique. An earlier version fell back to
 * `${Date.now().toString(16)}-${Math.random()...}` when storage threw, on the
 * reasoning that a random id per call is still random enough. Postgres
 * disagreed: every such insert came back 400,
 * `invalid input syntax for type uuid`. The fallback path silently could not
 * write at all — the one path that most needed to work, because it is the
 * private-mode visitor.
 */
function uuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  try {
    if (typeof c?.randomUUID === 'function') return c.randomUUID();
    // `randomUUID` is secure-context only; `getRandomValues` is not. This is
    // the branch that runs when the site is opened over plain http on a LAN
    // address, which is exactly how it gets checked on a phone.
    if (typeof c?.getRandomValues === 'function') {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40; // version 4
      b[8] = (b[8] & 0x3f) | 0x80; // variant 10x
      const h = Array.from(b, (n) => n.toString(16).padStart(2, '0'));
      return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
    }
  } catch {
    /* fall through to Math.random */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Per-tab identity. `sessionStorage`, not `localStorage`: the brief is one
 * stroke per visitor per SESSION, and a value that survives the tab closing
 * would lock someone out of the section forever.
 */
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage disabled. A fresh UUID per call still writes;
    // it just cannot enforce the one-per-session rule client-side, and the
    // table's UNIQUE constraint is the real enforcement anyway.
    return uuid();
  }
}

export function hasSubmitted(): boolean {
  try {
    return sessionStorage.getItem(SUBMITTED_KEY) === '1';
  } catch {
    return false;
  }
}

function markSubmitted(): void {
  try {
    sessionStorage.setItem(SUBMITTED_KEY, '1');
  } catch {
    /* storage disabled — the DB constraint still holds the line */
  }
}

function readCache(): Stroke[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Stroke[]) : [];
  } catch {
    return [];
  }
}

function writeCache(strokes: Stroke[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(strokes));
  } catch {
    /* quota or private mode — the cache is an optimisation, not a requirement */
  }
}

/**
 * The most recent strokes, newest first.
 *
 * Returns the cache on any failure, so the structure is never empty because a
 * network was slow. `cached` tells the caller which it got, for the HUD-ish
 * count line — not for an error message.
 */
export async function fetchStrokes(
  signal?: AbortSignal,
): Promise<{ strokes: Stroke[]; cached: boolean }> {
  if (!traceConfigured) return { strokes: readCache(), cached: true };

  try {
    const res = await fetch(
      `${TABLE}?select=points&order=created_at.desc&limit=${TRACE.renderLimit}`,
      { headers: headers(), signal },
    );
    if (!res.ok) return { strokes: readCache(), cached: true };

    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return { strokes: readCache(), cached: true };

    // Validated on the way in as well as on the way out. This is the one place
    // data from outside the build enters the render loop, and a NaN here
    // becomes a NaN in a vertex buffer, which silently kills the whole draw
    // call rather than the one bad stroke.
    const strokes = rows
      .map((r) => (r as { points?: unknown }).points)
      .filter((p): p is number[] => Array.isArray(p))
      .map((p) => p.filter((n) => typeof n === 'number' && Number.isFinite(n)))
      .filter((p) => p.length >= TRACE.minPoints && p.length % 3 === 0);

    writeCache(strokes);
    return { strokes, cached: false };
  } catch {
    return { strokes: readCache(), cached: true };
  }
}

/** Live total. `null` when it cannot be read — never an error, never a zero. */
export async function fetchCount(signal?: AbortSignal): Promise<number | null> {
  if (!traceConfigured) return null;
  try {
    const res = await fetch(`${TABLE}?select=id`, {
      method: 'HEAD',
      headers: { ...headers(), Prefer: 'count=exact' },
      signal,
    });
    // PostgREST answers a count in Content-Range as `0-24/1234`.
    const range = res.headers.get('content-range');
    const total = range ? Number(range.split('/')[1]) : NaN;
    return Number.isFinite(total) ? total : null;
  } catch {
    return null;
  }
}

/**
 * Commit this session's stroke. Returns whether it landed.
 *
 * Enforces the same caps the table does before spending a request on
 * something that will be rejected: 120 points, a multiple of 3, finite, and
 * inside the bounds the CHECK constraint allows.
 */
export async function submitStroke(points: number[]): Promise<boolean> {
  if (!traceConfigured || hasSubmitted()) return false;

  const clean = points.filter((n) => Number.isFinite(n)).map((n) => Math.max(-1, Math.min(1, n)));
  const trimmed = clean.slice(0, TRACE.maxPoints * 3);
  const usable = trimmed.slice(0, trimmed.length - (trimmed.length % 3));
  if (usable.length < TRACE.minPoints) return false;

  try {
    const res = await fetch(TABLE, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ session_id: sessionId(), points: usable }),
    });
    // 409 is the unique constraint doing its job — this session already drew.
    // Marked as submitted either way, so the UI stops offering.
    if (res.ok || res.status === 409) {
      markSubmitted();
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}
