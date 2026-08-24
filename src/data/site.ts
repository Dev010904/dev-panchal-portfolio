/**
 * Contact and identity. The email is deliberately NOT stored as a single
 * literal anywhere that ships to the client as plain text — see
 * components/ui/Email.tsx for how it is reassembled at runtime.
 */

export const EMAIL_PARTS = ['devpanchal', '.web', '@', 'gmail', '.com'] as const;

/** Server-side / metadata use only. Never rendered into markup as-is. */
export const email = () => EMAIL_PARTS.join('');

export const site = {
  name: 'Dev Panchal',
  role: 'Web Developer',
  title: 'Dev Panchal — Web Developer & 3D Web Experiences',
  description: 'Websites and interactive 3D experiences built with Three.js, WebGL and GSAP.',
  /**
   * The canonical origin, and it has to be the real one.
   *
   * This single value feeds the canonical link, every Open Graph and Twitter
   * URL, the JSON-LD Person, and the Sitemap line in robots.txt. Pointing it at
   * a host the site no longer lives on is not cosmetic: it tells crawlers the
   * real pages are duplicates of somewhere else, and it hands social previews
   * a domain that may stop resolving.
   */
  url: 'https://dev-panchal.vercel.app',
  whatsapp: {
    /**
     * Display form only. Grouped +91 XXXXX XXXXX — the standard Indian
     * five-and-five split with the country code, because a bare ten-digit run
     * reads as a string of numbers rather than as a phone number, and an
     * international client cannot tell what to dial from it.
     *
     * Never build the href from this. `wa.me` takes digits with no spaces and
     * no plus sign, so the two forms are deliberately separate values rather
     * than one string with the punctuation stripped at the call site.
     */
    display: '+91 84602 89432',
    href: 'https://wa.me/918460289432',
  },
  // The platform name, not the handle, on all three. The link is the address;
  // printing the username as well says nothing extra and scatters the handle
  // across every footer on the site for anything scraping it.
  github: {
    display: 'GitHub',
    href: 'https://github.com/Dev010904',
  },
  linkedin: {
    display: 'LinkedIn',
    href: 'https://linkedin.com/in/dev-panchal-9b8047383',
  },
  instagram: {
    display: 'Instagram',
    href: 'https://www.instagram.com/devp.web_dev/',
  },
  /**
   * One string, used everywhere the site states where it is.
   *
   * It was `IND · REMOTE`, which is true and says almost nothing — "India" is a
   * country of 1.4 billion people and a client trying to work out time zones
   * and travel gets nothing from it. The city is the useful half.
   *
   * Kept as a single value because it appears in the About rail, the home
   * footer and every interior footer, and four copies of a location is how one
   * of them ends up saying something different from the others.
   */
  location: 'VADODARA, GUJARAT · REMOTE',
  /** Structured form of the same fact, for the JSON-LD Person. */
  address: {
    addressLocality: 'Vadodara',
    addressRegion: 'Gujarat',
    addressCountry: 'IN',
  },
} as const;

/**
 * THE CV, as a file.
 *
 * Deliberately not folded into SOCIALS. A resume is a different kind of thing
 * from a profile link: it is the artefact a recruiter forwards internally, it
 * is what gets attached to an email, and it is the one link on the page that
 * ends in a file rather than another website. Filing it between GitHub and
 * Instagram would rank it below both.
 *
 * The size is printed next to the link on purpose. An unlabelled PDF on mobile
 * data is a gamble, and 68 KB is small enough that saying so removes the only
 * reason someone would hesitate.
 */
export const resume = {
  href: '/Dev_Panchal_Resume.pdf',
  /** Rounded from the real file. Update this if the PDF is replaced. */
  size: '68 KB',
  /**
   * What the browser saves it as. The file in `public/` is named for the repo;
   * this is named for the person receiving it, who will have it in a downloads
   * folder next to fifty other resumes.
   */
  filename: 'Dev-Panchal-Resume.pdf',
} as const;

/**
 * The social block, in the order it is shown everywhere.
 *
 * Email is not in here — it is the primary channel and is always set larger and
 * apart from these. This is the "and also" list, ordered by how likely it is to
 * be the thing a client actually wants: message, then code, then CV, then the
 * one that is mostly for other designers.
 */
export const SOCIALS = [
  { key: 'whatsapp', label: 'WhatsApp', href: site.whatsapp.href },
  { key: 'github', label: site.github.display, href: site.github.href },
  { key: 'linkedin', label: site.linkedin.display, href: site.linkedin.href },
  {
    key: 'instagram',
    label: site.instagram.display,
    href: site.instagram.href,
  },
] as const;

export const NAV_SECTIONS = [
  { id: 'index', label: 'INDEX', display: 'Index' },
  { id: 'mark', label: 'THE MARK', display: 'The Mark' },
  { id: 'work', label: 'WORK', display: 'Work' },
  { id: 'lab', label: 'LAB', display: 'Lab' },
  { id: 'about', label: 'ABOUT', display: 'About' },
  { id: 'contact', label: 'CONTACT', display: 'Contact' },
] as const;
