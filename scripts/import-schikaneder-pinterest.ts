// Pinterest importer: Jakub Schikaneder -> artworks + artwork_external_ids.
// Third hash-aware consumer of AGENTS "Artwork multi-source backing" (after
// simonstalenhag.se and Wikimedia Commons). Pinterest's logged-out BoardFeedResource feed
// API serves whole boards over plain HTTP (page_size 100 + bookmark pagination), so no
// browser/CDP is needed. An item is ONE unique original image (i.pinimg.com originals are
// content-addressed, so every repin of the same upload collapses to a single item);
// externalId = `pinterest:<image path>`.
// Matching ladder mirrors the Commons adapter: exact normalized title + tolerant year
// first (pin captions carry "Jakub Schikaneder - Dusk 1896" style titles), then transient
// dHash against EVERY tracked row of this artist (63 at run time), then same-work clusters
// among would-be-new pins. Ambiguous/near results are held and reported loudly, never
// guessed. Images download only transiently for hashing (C:\tmp) — refs-only rule holds.
// Attribution gate: only a pin whose caption names Schikaneder may INSERT a new work;
// captionless board-only pins may still LINK (a hash/title match against Jakub's rows is
// proof) but a `new` one is held as no-attribution, never inserted blind.
// Run: esbuild bundle -> `node --env-file=.env.local <bundle>.cjs <mode>`
// Modes: scrape | urls | hash | import [--apply]
import { db } from '../src/db/index';
import { artists, artworks } from '../src/db/schema';
import { upsertArtworkSource } from '../src/lib/artists/artwork-sources';
import { eq, and, sql } from 'drizzle-orm';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const SCRAPE = 'C:/tmp/schikaneder-pinterest-scrape.json';
const HASH_IN = 'C:/tmp/schikaneder-pinterest-hash-input.json';
const HASH_OUT = 'C:/tmp/schikaneder-pinterest-hashes.json';
const HASH_CACHE = 'C:/tmp/schikaneder-pinterest-hash-cache'; // transient image cache (refs-only)
const HASH_JOBS = 'C:/tmp/schikaneder-pinterest-hash-jobs.json'; // {key,path} for the shared PS1
const HASH_JOBS_OUT = 'C:/tmp/schikaneder-pinterest-hash-jobs-out.json';
const REPORT = 'C:/tmp/schikaneder-pinterest-import-report.md';
const HASH_PS1 = 'scripts/import-schikaneder-hash.ps1';
// Reused tracked-side hashes from the Commons run: `w:<artworkId>` (wikiart rows) and
// `c:<commons file>` (rows reached through artwork_external_ids provider='commons') — 54 of
// the 63 tracked rows resolve from here; only arc/webumenia/gac rows need fresh `t:` downloads.
const COMMONS_HASH_OUT = 'C:/tmp/schikaneder-hashes.json';

const ARTIST_SLUG = 'jakub-schikaneder';
const PROVIDER = 'pinterest';
const FEED = 'https://www.pinterest.com/resource/BoardFeedResource/get/';
const PAGE_SIZE = 100;
const MAX_PAGES = 80;
const MAX_STALLS = 5;

// The six dedicated boards located by the 2026-10-15 probe (661 pins total). `expect` is
// the board page's SSR pin count — a run that ends short prints a loud SHORT line and the
// report marks the board incomplete (never silent).
const BOARDS: { url: string; id: string; expect: number }[] = [
  { url: 'barnett6115/jakub-s', id: '530510099794767643', expect: 241 },
  { url: 'archieauld/jakub-schikaneder', id: '334181303538970150', expect: 126 },
  { url: 'maryhy/art-jakub-schikaneder', id: '491314709287678219', expect: 140 },
  { url: 'volfi/jacub-schikaneder', id: '52213745619039649', expect: 70 },
  { url: 'peterristuccia/jakub-schikaneder', id: '478437229103137176', expect: 67 },
  { url: 'milankonacnost/jakub-schikaneder', id: '792704040600708846', expect: 17 },
];

// dHash decision bands — same shape as the Commons/Stålenhag importers. The floor check in
// `import` runs over EVERY tracked row of this artist (Stage B matches against all of them)
// and apply aborts when any unrelated pair sits <= MATCH_MAX unless that exact pair is a
// documented composition twin in KNOWN_TRACKED_TWINS.
const MATCH_MAX = 8;
const NEAR_MAX = 12;
const TITLE_CONFLICT_MAX = 20; // title match whose hash distance exceeds this is held as a conflict
const TITLE_YEAR_TOLERANCE = 1; // painting dates are disputed by a year across sources

// Creation-year sanity window for this artist (active ~1878-1918, died 1924).
const YEAR_MIN = 1850;
const YEAR_MAX = 1935;

// Tracked rows whose images can sit close while being DIFFERENT physical works — per pair
// with a written reason (the SCRAPE_EXCLUDE rule: never a silent pattern). Key = sorted
// artwork ids joined by ':'. Seed: the 2026-10-15 GAC verdict — Drowned (Liberec drawing)
// is the same composition as Utonulá (NGP pastel K 55116), two institutions cannot hold
// one object, so both rows stay; a captionless pin of this composition lands ambiguous-hash
// and is held for adjudication instead of guessed. Second seed: the 2026-10-15 Pinterest
// batch — the pin-43 insert (194480) sits at d6 from 171240 Molo while showing a different
// setting, so the pair is exempted instead of tripping the floor guard.
const KNOWN_TRACKED_TWINS: Record<string, string> = {
  '194342:194364':
    'Utonulá (NGP pastel, inv. K 55116) and Drowned (Liberec drawing 880x470mm) are one composition held as two physical works — adjudicated 2026-10-15 (GAC verdict)',
  '171240:194480':
    'Molo (moonlit pier) and the pin-43 insert (woman at a lamp-lit window) are different compositions — 2026-10-15 v2-43 vision sheet; the d6 hash is a dark-toned artifact',
};

// F7 (triage 2026-10-15): pins vision-adjudicated as a specific tracked work whose upload
// is too divergent to hash-match (re-photo of a print: dist 27 vs the real image). The
// verdict — not the distance — decides; dist is computed and printed for transparency only.
// Key = pin image path (the item `src`); Stage B force-links these BEFORE any dist decision.
// The first F7 entry (d278d58d → 194360) was WRONG and was removed 2026-10-15: that pin's
// image is the sunset shore, identical to pin 0ff3e367 at dist 1, while 194360 (webumenia
// IO_400) is a cliff/beach painting — and the pin-02 verdict (v2-02 sheet) had already ruled
// pin 02 ≠ 194360. The extid moved to 194475 (the 0ff3e367 insert, retitled from the pin's
// own caption "Na břehu ostrova Helgoland," + 1924) and the pin re-links by title through
// the normal Stage-A path, so no donor entry is needed for it.
const HASH_DONORS: Record<string, { artworkId: number; why: string }> = {
  'originals/a9/74/1a/a9741adbc7bf14e7a241ad99f4669ba8.jpg': {
    artworkId: 194361,
    why: 'image-verdict 2026-10-15: caption "Maltézské square (1906)" = Maltézské náměstí v mlze (webumenia CZE:PNP.IO_399), re-photo of a print',
  },
};

// Per-pin stray captions: content from the Mozart-era orbit or another artist that wanders
// onto a dedicated board. Checked per pin; an item is excluded only when EVERY caption is
// stray (mixed groups keep their good captions).
const STRAY_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bemanuel\s+schikaneder\b/i, reason: 'Emanuel Schikaneder (Mozart librettist), not Jakub' },
  { re: /\bmozarteum\b|\bzauberfl/i, reason: 'Zauberflöte/Mozarteum theatre-exhibit material (per the GAC verdict), not a Jakub painting' },
  { re: /\bjosef\s+mandl\b/i, reason: 'caption names Josef Mandl (another Czech painter)' },
  { re: /\bmozart\b/i, reason: 'Mozart-only caption with no artist attribution (Emanuel Schikaneder orbit)' },
];

// Captions that normalize into a word which can never be a title of this artist's work.
// F3 (triage 2026-10-15): expanded from the first dry run's NEW bucket — UI chrome, sites,
// handles, digit-only captions. Each entry was observed in a board caption; never speculative.
const JUNK_TITLES = new Set([
  'painting',
  'image',
  'photo',
  'picture',
  'artwork',
  'drawing',
  'illustration',
  'digitalart',
  'poster',
  'wallart',
  'fineart',
  'oilpainting',
  'classicalpainting',
  'masterpiece',
  'jakub',
  'jakob',
  'schikaneder',
  'jakubschikaneder',
  // observed 2026-10-15 dry run
  'paintings',
  'painter',
  'maler',
  'photos',
  'pictures',
  'drawings',
  'login',
  'registerlogin',
  'googlesearch',
  'vk', // VKontakte share-button chrome
  'tumblr',
  'notfound',
  'creativoas', // 'CREATIVO a.s.' — a company caption
  'franswazz', // unidentifiable signature-tag, not a work title
  'sophisticagallery', // '( ) Sophistica Gallery' after the empty-paren strip
  'catonhottinroof', // observed gridtitle verbatim; also the Tennessee Williams play fold below
  'catonahottinroof', // fold of "Cat on a Hot Tin Roof"
  'apaintingbyjakubschikaneder',
  'journalofanobodyphoto',
  'laclefdescoeurs', // observed gridtitle verbatim (pre-stripped ASCII of "La-clef-des-cœurs")
  'laclefdescurs', // fold of 'La-clef-des-cœurs' — œ has no NFKD decomposition, dropped by the fold
  'comajispolecnehoobrazyapreklady', // Czech article headline ('what do paintings and translations have in common')
  // added 2026-10-15 by the held-pin verdict batch — board repins whose caption is a blog
  // footer, stock alt-text, or site chrome; whole-title folds only, so real titles survive
  'windypoplarsroom', // wood-narrative blog footer on several repins
  'impressionisticnocturnes', // Pinterest alt-text sentence on several repins
  'thedomainnameisregistered', // parked-domain banner caption
  'themysteriousmoods', // exhibition-blog footer
  'amanwithapast', // board name pasted as a caption
  'rosebriar', // rose-cultivation blog footer
  'prague', // caption reduced to just the city name after the paren strip
]);

// Folded-title substrings that mark a caption as junk regardless of what wraps them.
// Runs AFTER junkStrip, so 'J. Schikaneder Na Ztracené Vartě' is already stripped to the real
// title by the artist-prefix rules — a surviving 'schikaneder' in the fold is an article or
// meta mention ('Nejedlý a netypický Schikaneder', 'Image result for …'), never a work title.
const JUNK_REGEX: { re: RegExp; reason: string }[] = [
  { re: /google/, reason: 'Google search / image-result caption' },
  { re: /imageresult/, reason: 'image-search caption' },
  { re: /afbeeldingsresultaat/, reason: 'Dutch image-search caption' },
  { re: /hledatgoogle/, reason: 'Czech Google-search caption' },
  { re: /wikipedia/, reason: 'Wikipedia caption' },
  { re: /registerlogin/, reason: 'site login-wall caption' },
  { re: /archivclanku/, reason: 'article-archive caption (Česká beseda)' },
  { re: /galer/, reason: 'gallery / auction-house caption' },
  { re: /aukc/, reason: 'auction caption' },
  { re: /schikaneder/, reason: 'artist-mention caption (name survives the prefix strips — an article/meta line, not a title)' },
  { re: /expressionnisme/, reason: 'French article headline' },
  { re: /malerder/, reason: 'German article fragment' },
  { re: /journalofanobody/, reason: 'blog name' },
  { re: /blog/, reason: 'blog caption' },
  { re: /lidovky/, reason: 'news headline (Lidovky.cz)' },
  { re: /obrazynaplatne/, reason: 'print-shop caption (ObrazyNaPlátně.cz)' },
  { re: /olympus/, reason: 'camera EXIF caption' },
  { re: /catonhottinroof/, reason: 'Tennessee Williams play title pasted onto the pin gridtitle' },
  { re: /forpsi/, reason: 'hosting-company caption (Forpsi.com)' },
  { re: /neurociencia/, reason: 'journal headline (Neurociências em Debate)' },
  { re: /page\d+$/, reason: 'blog pagination caption' },
  { re: /klikni/, reason: 'image-gallery click-through caption' },
  { re: /twitter/, reason: 'social-share caption line (Twitter/X)' },
];

// F5 (triage 2026-10-15): captions naming ANOTHER artist — the title is rejected (it is that
// artist's work, not Schikaneder's) AND its year must not attach to this image; the item is
// kept (its image may still be a Jakub work a junk caption was pinned under).
const OTHER_ARTIST_TITLES: { key: string; why: string }[] = [
  { key: 'camillepissarro', why: 'title names Camille Pissarro (French painter), not Jakub' },
  { key: 'jindrichtomec', why: 'title names Jindřich Tomec (Czech painter), not Jakub' },
  { key: 'vladimirondys', why: 'title names Vladimír Ondys (Czech artist), not Jakub' },
];

type RawPin = {
  id?: string;
  seo_url?: string;
  title?: string;
  grid_title?: string;
  description?: string;
  alt_text?: string;
  auto_alt_text?: string;
  link?: string;
  domain?: string;
  repin_count?: number;
  images?: { orig?: { url?: string; width?: number; height?: number } };
};
type FeedJson = { resource_response?: { status?: string; bookmark?: string | null; data?: RawPin[] } };

type BoardStat = { url: string; id: string; expect: number; got: number; pages: number; complete: boolean };

type PinRec = {
  pinId: string;
  board: string;
  seo: string | null;
  repin: number;
  gridTitle: string;
  title: string;
  desc: string;
  alt: string;
  autoAlt: string;
  stray: string | null;
};

type PinterestItem = {
  src: string; // image path (stable external-id key), e.g. 'originals/ab/cd/<hash>.jpg'
  file: string; // = src (display)
  url: string; // originals URL (hash + imageUrl)
  page: string; // best pin page (sourceUrl / paintingUrl)
  sourcePin: string;
  title: string;
  titleSource: 'gridtitle' | 'title' | 'alt' | 'desc' | null; // F2: autoAlt dropped — AI alt sentences are never titles
  year: number | null;
  yearSource: 'caption' | null;
  attributed: boolean; // some non-stray caption names Schikaneder
  pins: number;
  boards: string[];
  repinMax: number;
  exclude?: string;
};

type TrackedRow = {
  id: number;
  title: string;
  year: number | null;
  imageUrl: string | null;
  paintingUrl: string | null;
  externalId: string;
  provider: string;
};

type Decision =
  | { type: 'title'; wikiId: number; confidence: 100 }
  | { type: 'hash'; wikiId: number; dist: number; confidence: 90; donor?: string }
  | { type: 'ambiguous-title'; cands: { id: number; file: string }[]; conflictDist?: number }
  | { type: 'ambiguous-hash'; cands: { file: string; dist: number }[] }
  | { type: 'near'; best: { id: number; dist: number }; second: { id: number; dist: number } | null }
  | { type: 'dup-target'; wikiId: number; dist: number }
  | { type: 'pinterest-same'; of: string } // same artwork as another pin item (title+year+hash agree, or image-identical)
  | { type: 'hold-nohash' }
  | { type: 'no-attribution' } // board-only pin, no Schikaneder caption — held, never inserted
  | { type: 'verdict-drop'; why: string } // adjudicated non-work (photo/stamp/other artist) — reported, never applied
  | { type: 'new' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- shared helpers (copied from import-schikaneder-commons.ts — that module runs main()
// on import, so these cannot be imported from it without side effects) ----

function normTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Hashes are 64-char binary strings ('0'/'1'), not hex — compare every bit.
function hammingBits(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) d += 1;
  return d + Math.abs(a.length - b.length);
}

function rangeYear(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw >= YEAR_MIN && raw <= YEAR_MAX ? raw : null;
}

function firstYearIn(s: string): number | null {
  // a year RANGE denotes the painting's window — take its END; a single 4-digit keeps the first
  const range = /(\d{4})\s*[-–]\s*(\d{2,4})/.exec(s);
  if (range) {
    const start = Number(range[1]);
    let end = Number(range[2]);
    if (range[2].length <= 3) end = Math.floor(start / 100) * 100 + end;
    const yr = rangeYear(end) ?? rangeYear(start);
    if (yr != null) return yr;
  }
  const m = /(\d{4})/.exec(s);
  return m ? rangeYear(Number(m[1])) : null;
}

function yearsCompat(a: number | null, b: number | null): boolean {
  return a == null || b == null || Math.abs(a - b) <= TITLE_YEAR_TOLERANCE;
}

// ---- F1 guarded mojibake repair (triage 2026-10-15) ----
// Pin captions arrive as UTF-8 text decoded with the wrong table. Two reversible schemes:
//   A: the UTF-8 BYTES were misread as cp1250  -> re-encode cp1250, fatal-decode UTF-8
//   B: cp1250 BYTES were misread as cp1252      -> re-encode cp1252, decode cp1250
// Both guarded: re-encodable + output differs + no U+FFFD. Scheme B additionally requires
// the WHOLE input to be cp1250-representable — genuine Scandinavian/French text (Krøyer,
// cœurs) then fails the guard instead of turning into Krřyer/cśurs (probe 2026-10-15: A gave
// 3 true fixes of 311 titles, B gave 2 false positives and 0 true ones; every B-marker from
// genuine Czech mojibake — è/ò/ù/ø — is cp1250-absent by construction, so B stays as the
// theoretically-correct branch for its one overlap window and stays silent here).
// A position whose original char died BEFORE this caption (the EF BF BD triple from
// 'ďż˝') cannot be recovered — repair returns null and the title falls through to junkReject.
// Tables are built from TextDecoder at runtime, never hand-typed.
const CP1250_DEC = new TextDecoder('windows-1250');
const CP1252_DEC = new TextDecoder('windows-1252');
const FATAL_UTF8 = new TextDecoder('utf-8', { fatal: true });
const byteTable = (dec: TextDecoder): Map<string, number> => {
  const m = new Map<string, number>();
  for (let b = 0; b < 256; b += 1) {
    const ch = dec.decode(Uint8Array.of(b));
    if (ch !== '\uFFFD' && !m.has(ch)) m.set(ch, b); // first byte wins on collisions
  }
  return m;
};
const CP1250_ENC = byteTable(CP1250_DEC);
const CP1252_ENC = byteTable(CP1252_DEC);
const encodeWith = (tab: Map<string, number>, s: string): Uint8Array | null => {
  const bytes: number[] = [];
  for (const ch of s) {
    const b = tab.get(ch);
    if (b == null) return null;
    bytes.push(b);
  }
  return Uint8Array.from(bytes);
};

const MOJIBAKE_FIXED = new Set<string>();
function repairMojibake(orig: string): string | null {
  let out: string | null = null;
  let scheme = 'A';
  const a = (() => {
    const bytes = encodeWith(CP1250_ENC, orig);
    if (!bytes) return null;
    try {
      return FATAL_UTF8.decode(bytes);
    } catch {
      return null; // not valid UTF-8 as cp1250 bytes
    }
  })();
  if (a != null && a !== orig && !a.includes('\uFFFD')) out = a;
  if (out == null) {
    const bytes = encodeWith(CP1252_ENC, orig);
    if (bytes) {
      const b = CP1250_DEC.decode(bytes);
      if (
        b !== orig &&
        !b.includes('\uFFFD') &&
        [...orig].every((ch) => CP1250_ENC.has(ch)) // F1 FP guard: cp1250-representable input only
      ) {
        out = b;
        scheme = 'B';
      }
    }
  }
  if (out == null) return null;
  const key = `${orig}\u0000${out}`;
  if (!MOJIBAKE_FIXED.has(key)) {
    MOJIBAKE_FIXED.add(key);
    console.error(`MOJIBAKE-FIXED [${scheme}] ${JSON.stringify(orig)} -> ${JSON.stringify(out)}`);
  }
  return out;
}

// An EF BF BD byte triple survives re-encoding as the literal chars 'ďż˝' — the marker that
// one character of this caption was destroyed upstream (F1: unrecoverable -> reject the title,
// fall to the next field / the F9 bare path; never reconstruct a word by guessing).
const hasDeadMojibake = (t: string): boolean => {
  if (t.includes('\uFFFD')) return true;
  const b = encodeWith(CP1250_ENC, t);
  if (b) for (let i = 0; i + 2 < b.length; i += 1) if (b[i] === 0xef && b[i + 1] === 0xbf && b[i + 2] === 0xbd) return true;
  return false;
};

// F3/F5: classify a post-junkStrip title as never-a-work-title. `dropYear` marks captions
// that date ANOTHER artist's work — its year must not attach to this image; every other junk
// rejection keeps the caption's year (the image itself may still be dated by it).
const JUNK_PRINTED = new Set<string>();
function junkReason(t: string): { reason: string; dropYear: boolean } | null {
  if (hasDeadMojibake(t)) return { reason: 'unrecoverable mojibake (lost-character marker in the title)', dropYear: false };
  const nt = normTitle(t);
  if (!nt) return { reason: 'folds to empty (non-Latin text)', dropYear: false };
  if (/^\d+$/.test(nt)) return { reason: 'digits only', dropYear: false };
  if (/^[0-9a-f]{24,}$/.test(nt)) return { reason: 'hex identifier', dropYear: false };
  if (nt.length === 1) return { reason: 'single character', dropYear: false };
  if (JUNK_TITLES.has(nt)) return { reason: 'junk title', dropYear: false };
  for (const o of OTHER_ARTIST_TITLES) if (nt.includes(o.key)) return { reason: o.why, dropYear: true };
  for (const j of JUNK_REGEX) if (j.re.test(nt)) return { reason: j.reason, dropYear: false };
  return null;
}

// Removals only, never invent a title. Same strip list the Commons adapter runs over its
// ObjectName/filename text — pin captions carry the same artist-prefix/medium/year junk.
function junkStrip(s0: string): string | null {
  let s = s0;
  if (!s) return null;
  s = s.replace(/^(Czech|German|English|Polish|French|Slovak):\s*/i, '');
  // NB: hyphen escaped inside the classes — unescaped between ',' and '–' it forms a
  // U+002C–U+2013 range that matches every letter and eats the whole title.
  s = s.replace(/^(?:J\.|Jakub|Jakob)\s*,?\s+Schikaneder[\s,\-–—]*/i, ''); // F6: 'J. Schikaneder Na Ztracené Vartě …'
  s = s.replace(/^Schikaneder\s+(?:J\.|Jakub|Jakob)[\s,\-–—]*/i, '');
  s = s.replace(/^Schikaneder[\s,\-–—]*/i, '');
  s = s.replace(/^(?:Jakub|Jakob)\s*[-–—:.]+\s*/, ''); // bare artist prefix ('Jakub -. Street at Sunset') (F6)
  s = s.replace(/\s+(?:CZE\s+)?(?:NG\.[KO]|NG|O|DO)\s*\d{3,6}$/, '');
  // print-shop tail (F6): 'Dozvuky zimy – reprodukce na plátně ObrazyNaPlátně.cz' — matches the
  // mojibake spelling too, so even an unrepaired title sheds the shop text before its
  // dead-character residue is rejected
  const repIdx = s.search(/\s+[-–—,]\s*reprodukce\s+na\s+pl/i);
  if (repIdx !== -1) s = s.slice(0, repIdx);
  s = s.replace(/\s+#.*$/, ''); // hashtag tail ('Lovers (1909) #painting #art #Czechia') (F6)
  // provenance tails (F6): museum / private-collection attribution trailing the caption
  s = s.replace(
    /\s*,?\s+[-–—]?\s*(?:National Gallery in Prague|NG Prague|N[áa]rodn[íi] galerie v Praze|soukrom[áa] sb[íi]rka|a private collection)\b.*$/i,
    '',
  );
  // medium cut — comma NOT required (F6): captions write '…, 1905 Oil on canvas / Huile sur toile 70,5 x 98 cm'
  const medIdx = s.search(
    /(?:^|[,\-–—]\s*|\s+)(?:olej|pl[áa]tno|pl[áa]tn[ěe]|pastel|kartonu|akvarel|akryl|tempera|kusovna|d[řr]evo|lepenka|canvas|oil on|huile sur toile|watercolou?r|gouache|kresba|uhel|tu[šs]|lav[ií]rov\w*)\b/i,
  );
  if (medIdx !== -1) s = s.slice(0, medIdx);
  const dimIdx = s.search(/(?:^|[,\-–—]\s*|\s+)\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*cm\b/i); // dimension tail '98 x 150 cm'
  if (dimIdx !== -1) s = s.slice(0, dimIdx);
  s = s.replace(/\s*\((?:pastel|uhel|olej|akvarel|kresba|lavírovan\w*|tu[šs]|kvas|karton\w*)[^)]*\)$/i, '');
  s = s.replace(/\s*\(po roce \d{4}\)\s*$/i, '');
  s = s.replace(/\s*\(\s*\)/g, ' '); // empty parens ('( ) painter', '( ) Sophistica Gallery') (F6)
  s = s.replace(/\s*\((?:18|19)\d{2}(?:\s*[-–]\s*\d{1,4})?\)/g, ' '); // paren-year ANYWHERE, not just trailing (F6)
  s = s.replace(/,\s*(?:18|19)\d{2}\s+(?:18|19)\d{2}\s*$/, '');
  s = s.replace(/,\s*(?:18|19)\d{2}\s*[-–]\s*(?:18|19)\d{2}\s*$/, ''); // 'Interior, 1910-1915' (F6)
  s = s.replace(/\s*,?\s+by\s+(?:Jakub|Jakob)\s+Schikaneder\s*$/i, '');
  s = s.replace(/^\s*(?:18|19)\d{2}\s+/, ''); // leading year ('1909 EveningInTýnskáLn') (F6)
  s = s.replace(/\s+[-–—,|:]\s*$/, ''); // trailing separator BEFORE the trailing-year strip, so '…, 1924,' still drops the year
  s = s.replace(/\s+(?:18|19)\d{2}$/, ''); // 'Ruch 1883' -> 'Ruch'
  s = s.replace(/\s+[-–—,|:]\s*$/, '');
  return s.trim() || null;
}

// Pin captions are user text: artist-prefixed titles ('Jakub Schikaneder - Dusk 1896'),
// pipe lists ('Dusk | Jakub Schikaneder | 1896'), bio tails ('... by Jakub Schikaneder
// (Czech, 1855-1924)'). Removals only; auto-generated alt/description sentences never
// become titles. Returns the caption's title AND the year from the SAME caption (a year
// from a different pin's caption is never paired with this title).
function parseCaption(raw: string | null | undefined): { title: string | null; year: number | null } {
  if (!raw) return { title: null, year: null };
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return { title: null, year: null };
  const fixed = repairMojibake(s); // F1: guarded scheme-A/B repair, loud + deduped — runs before every guard/strip
  if (fixed) s = fixed;
  // auto alt/description text is a sentence, not a title
  if (/^(a|an|the|this)\s+(painting|image|photo|picture|close[-\s]?up|drawing|illustration|view|shot|print)\b/i.test(s)) {
    return { title: null, year: null };
  }
  // artist bio tags / life-dates are never a work year (b. 3 April 1855, d. 15 November 1924)
  s = s.replace(/\((?:czech|čech)[^)]*\)/gi, ' ');
  s = s.replace(/\(\s*(?:b|born)[.,]?\s*1[89]\d{2}\s*\)/gi, ' '); // '(b,1855)' birth-date tag (F6)
  s = s.replace(/\b\d{1,2}\s*(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+1855\b/gi, ' ');
  s = s.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:1855|1924)\b/gi, ' ');
  s = s.replace(/\b1855\s*[-–—]\s*1924\b/g, ' ');
  s = s.replace(/\(\s*[-–—,]+\s*\)/g, ' ');
  // drop the artist segment from pipe lists, then flatten remaining separators
  s = s.replace(/\s*\|\s*(?:Jakub|Jakob)\s+Schikaneder\b/gi, ' ');
  s = s.replace(/\b(?:Jakub|Jakob)\s+Schikaneder\s*\|/gi, ' ');
  s = s.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const year = firstYearIn(s);
  const t = junkStrip(s);
  if (!t) return { title: null, year };
  const j = junkReason(t);
  if (j) {
    // F3/F5: reject the TITLE loudly (deduped), keep the item; other-artist captions also drop their year
    const key = `${t}\u0000${j.reason}`;
    if (!JUNK_PRINTED.has(key)) {
      JUNK_PRINTED.add(key);
      console.error(`JUNK-TITLE ${JSON.stringify(t)} — ${j.reason}`);
    }
    return { title: null, year: j.dropYear ? null : year };
  }
  return { title: t, year };
}

function strayReason(text: string): string | null {
  for (const p of STRAY_PATTERNS) {
    if (p.re.test(text)) {
      // Mozart-opera patterns only stray a pin that carries no artist attribution at all —
      // 'Jakub Schikaneder - ... Mozart theatre' stays (it names Jakub explicitly).
      if (p.reason.startsWith('Mozart-only') && /\b(jakub|jakob|schikaneder)\b/i.test(text)) continue;
      return p.reason;
    }
  }
  return null;
}

function imgPath(origUrl: string): string | null {
  try {
    const u = new URL(origUrl);
    if (!/(^|\.)pinimg\.com$/.test(u.hostname)) return null;
    return u.pathname.replace(/^\/+/, '');
  } catch {
    return null;
  }
}

function pinPage(seo: string | null, pinId: string): string {
  if (seo) return seo.startsWith('http') ? seo : `https://www.pinterest.com${seo}`;
  return `https://www.pinterest.com/pin/${pinId}/`;
}

// ---- scrape ----

async function feedOnce(board: { url: string; id: string }, bookmark: string | null): Promise<{ pins: RawPin[]; bookmark: string | null }> {
  const options: Record<string, unknown> = {
    board_id: board.id,
    field_set_key: 'react_grid_pin',
    page_size: PAGE_SIZE,
    filter_section_pins: false,
  };
  if (bookmark) options.bookmark = bookmark;
  const data = encodeURIComponent(JSON.stringify({ options, context: {} }));
  const url = `${FEED}?data=${data}&sourceUrl=/${board.url}/&_=${Date.now()}`;
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          accept: 'application/json',
          'x-pinterest-pws-handler': 'www/[username]/[board].js',
          'x-pinterest-appstate': 'active',
          'x-requested-with': 'XMLHttpRequest',
          referer: `https://www.pinterest.com/${board.url}/`,
        },
      });
      if (!res.ok) {
        lastErr = `status=${res.status}`;
        if (res.status === 400 || res.status === 403) throw new Error(`BoardFeedResource ${lastErr} for ${board.url} — invalid resource/board id, no fallback`);
        await sleep(2000 * attempt);
        continue;
      }
      const j = (await res.json()) as FeedJson;
      const rr = j.resource_response;
      if (!rr || rr.status !== 'success' || !Array.isArray(rr.data)) {
        lastErr = `resource_response.status=${rr?.status ?? 'missing'}`;
        await sleep(2000 * attempt);
        continue;
      }
      return { pins: rr.data, bookmark: rr.bookmark ?? null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/no fallback/.test(msg)) throw e;
      lastErr = `network:${msg}`;
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`BoardFeedResource FAILED for ${board.url} after 4 attempts (${lastErr}) — no fallback, aborting`);
}

async function scrape(): Promise<void> {
  const pinsById = new Map<string, RawPin>();
  const boardOfPin = new Map<string, string>();
  const boardStats: BoardStat[] = [];
  for (const b of BOARDS) {
    let bookmark: string | null = null;
    const seen = new Set<string>();
    let got = 0;
    let pages = 0;
    let stalls = 0;
    while (pages < MAX_PAGES) {
      pages += 1;
      const res = await feedOnce(b, bookmark);
      let fresh = 0;
      for (const p of res.pins) {
        if (!p.id || seen.has(p.id)) continue;
        seen.add(p.id);
        fresh += 1;
        got += 1;
        pinsById.set(p.id, p);
        if (!boardOfPin.has(p.id)) boardOfPin.set(p.id, b.url);
      }
      if (res.bookmark && fresh > 0) {
        bookmark = res.bookmark;
        stalls = 0;
        await sleep(400);
        continue;
      }
      // transient short pages come back without a bookmark — retry the same position
      if (got < b.expect && stalls < MAX_STALLS && fresh > 0) {
        stalls += 1;
        await sleep(600);
        continue;
      }
      break;
    }
    const complete = got >= b.expect;
    if (!complete) console.error(`SHORT ${b.url}: got=${got} expect=${b.expect} pages=${pages} — pins possibly missed, report marks the board incomplete`);
    boardStats.push({ url: b.url, id: b.id, expect: b.expect, got, pages, complete });
    console.log(`board ${b.url}: ${got}/${b.expect} pins (${pages} pages)`);
    await sleep(500);
  }

  // group pins by content-addressed original image path (repins collapse to one item)
  const groups = new Map<string, PinRec[]>();
  const noOrig: string[] = [];
  const nonPinimg: string[] = [];
  let strayPins = 0;
  for (const p of pinsById.values()) {
    const orig = p.images?.orig?.url;
    if (!orig) {
      noOrig.push(p.id ?? '(no id)');
      continue;
    }
    const path = imgPath(orig);
    if (!path) {
      nonPinimg.push(p.id ?? '(no id)');
      continue;
    }
    const text = [p.title, p.grid_title, p.description, p.alt_text, p.auto_alt_text, p.seo_url, p.link]
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .join(' \n ');
    const stray = strayReason(text);
    if (stray) strayPins += 1;
    const rec: PinRec = {
      pinId: p.id ?? '(no id)',
      board: boardOfPin.get(p.id ?? '') ?? '',
      seo: typeof p.seo_url === 'string' && p.seo_url.length > 0 ? p.seo_url : null,
      repin: typeof p.repin_count === 'number' ? p.repin_count : 0,
      gridTitle: p.grid_title ?? '',
      title: p.title ?? '',
      desc: p.description ?? '',
      alt: p.alt_text ?? '',
      autoAlt: p.auto_alt_text ?? '',
      stray,
    };
    const list = groups.get(path);
    if (list) list.push(rec);
    else groups.set(path, [rec]);
  }
  if (noOrig.length > 0)
    console.error(
      `NO-ORIG ${noOrig.length} pin(s) without images.orig.url — Pinterest injected UI modules (related_interests/board_ideas "story" pins; verified contentless 2026-10-15: their pin pages all embed the same Pinterest-icon placeholder PNG), no artwork lost`,
    );
  if (nonPinimg.length > 0) console.error(`NON-PINIMG ${nonPinimg.length} pin(s) with an original URL outside pinimg.com dropped`);

  const items: PinterestItem[] = [];
  const excluded: PinterestItem[] = [];
  let attributedCount = 0;
  for (const [path, pins] of groups) {
    // best pin first: highest repin count, then stable pinId order
    const sorted = [...pins].sort((a, b) => b.repin - a.repin || (a.pinId < b.pinId ? -1 : 1));
    const good = sorted.filter((p) => p.stray == null);
    const strayOnly = sorted.filter((p) => p.stray != null);
    const boards = [...new Set(sorted.map((p) => p.board).filter((b) => b.length > 0))].sort();
    const best = sorted[0]!;

    // F4: attribution-first stable partition — a caption that names Schikaneder is the likelier
    // real title, so captioned pins pick before a higher-repin repin; order stays stable inside
    // each half (repin, then pinId). Sits above the NO-ATTRIBUTION gate, never weakening it.
    const namesSchikaneder = (p: PinRec): boolean =>
      /\bschikaneder\b/i.test([p.gridTitle, p.title, p.desc, p.alt, p.autoAlt].join(' '));
    const goodOrdered = [...good.filter(namesSchikaneder), ...good.filter((p) => !namesSchikaneder(p))];

    let title: string | null = null;
    let titleSource: PinterestItem['titleSource'] = null;
    let year: number | null = null;
    let yearFallback: number | null = null; // F3/F5: a junk-rejected caption still dates the image (other-artist captions drop their year inside parseCaption)
    if (goodOrdered.length > 0) {
      // title+year must come from ONE coherent caption (one pin's own fields), best pin first
      outer: for (const p of goodOrdered) {
        // F2: no 'autoalt' — AI alt sentences are never titles (p.autoAlt still feeds `attributed`)
        const fs: { key: PinterestItem['titleSource']; v: string }[] = [
          { key: 'gridtitle', v: p.gridTitle },
          { key: 'title', v: p.title },
          { key: 'alt', v: p.alt },
          { key: 'desc', v: p.desc },
        ];
        for (const f of fs) {
          if (!f.v) continue;
          const parsed = parseCaption(f.v);
          if (parsed.title) {
            title = parsed.title;
            titleSource = f.key;
            year = parsed.year;
            if (year == null) {
              // the same pin's other fields may carry the year (title field bare, desc dated)
              for (const g of fs) {
                if (g.key === f.key || !g.v) continue;
                const y2 = firstYearIn(g.v);
                if (y2 != null) {
                  year = y2;
                  break;
                }
              }
            }
            break outer;
          }
          if (yearFallback == null && parsed.year != null) yearFallback = parsed.year;
        }
      }
      if (title == null) year = yearFallback;
    }

    const attributed = good.length > 0 && good.some(namesSchikaneder);
    if (attributed) attributedCount += 1;

    const item: PinterestItem = {
      src: path,
      file: path,
      url: `https://i.pinimg.com/${path}`,
      page: pinPage(best.seo, best.pinId),
      sourcePin: best.pinId,
      title: title ?? '',
      titleSource,
      year,
      yearSource: year != null ? 'caption' : null,
      attributed,
      pins: pins.length,
      boards,
      repinMax: best.repin,
    };
    if (good.length === 0 && strayOnly.length > 0) {
      item.exclude = `${strayOnly[0]!.stray ?? 'stray'} (every caption)`;
      excluded.push(item);
      continue;
    }
    items.push(item);
  }

  items.sort((a, b) => (a.src < b.src ? -1 : 1));
  excluded.sort((a, b) => (a.src < b.src ? -1 : 1));
  if (items.length === 0) throw new Error('scrape produced 0 items — feed broken, no fallback');

  const unattr = items.filter((i) => !i.attributed).length;
  writeFileSync(SCRAPE, JSON.stringify({ boards: boardStats, noOrig: noOrig.length, items: [...items, ...excluded] }, null, 2));
  console.log(
    `SCRAPE done: pins=${pinsById.size} items=${items.length} (attributed=${attributedCount} board-only=${unattr}) excluded=${excluded.length} strayPins=${strayPins} uiModules=${noOrig.length} -> ${SCRAPE}`,
  );
}

// ---- load scrape state ----

type ScrapeFile = { boards: BoardStat[]; noOrig: number; items: PinterestItem[] };

function loadScrape(): ScrapeFile {
  if (!existsSync(SCRAPE)) throw new Error(`scrape state missing ${SCRAPE} — run scrape first, no fallback`);
  const parsed = JSON.parse(readFileSync(SCRAPE, 'utf8')) as ScrapeFile;
  if (!Array.isArray(parsed.items) || !Array.isArray(parsed.boards)) throw new Error(`scrape state malformed ${SCRAPE} — no fallback`);
  if (typeof parsed.noOrig !== 'number') throw new Error(`scrape state missing noOrig count ${SCRAPE} — re-run scrape, no fallback`);
  return parsed;
}

// items = everything the ladder sees (kept + excluded, excluded carry their reason so the
// report can list them — same partition shape as the Commons adapter)
function loadItems(): PinterestItem[] {
  return loadScrape().items;
}

function partitionExcluded(all: PinterestItem[]): { kept: PinterestItem[]; excluded: PinterestItem[] } {
  const kept: PinterestItem[] = [];
  const excluded: PinterestItem[] = [];
  for (const it of all) {
    if (it.exclude) {
      console.log(`EXCLUDED ${it.src} — ${it.exclude}`);
      excluded.push(it);
    } else {
      kept.push(it);
    }
  }
  return { kept, excluded };
}

// ---- tracked rows + hash reuse ----

async function loadArtistAndTracked(): Promise<{ artistRow: { id: number }; tracked: TrackedRow[] }> {
  const [artistRow] = (await db
    .select({ id: artists.id })
    .from(artists)
    .where(and(eq(artists.provider, 'wikiart'), eq(artists.slug, ARTIST_SLUG)))
    .limit(1)) as { id: number }[];
  if (!artistRow) throw new Error(`artist ${ARTIST_SLUG} has no artworks rows — sync first, no fallback`);
  const tracked = (await db
    .select({
      id: artworks.id,
      title: artworks.title,
      year: artworks.year,
      imageUrl: artworks.imageUrl,
      paintingUrl: artworks.paintingUrl,
      externalId: artworks.externalId,
      provider: artworks.provider,
    })
    .from(artworks)
    .where(eq(artworks.artistId, artistRow.id))) as TrackedRow[];
  if (tracked.length === 0) throw new Error(`artist ${ARTIST_SLUG} -> 0 rows, no fallback`);
  return { artistRow, tracked };
}

// artwork_id -> commons filename (from artwork_external_ids provider='commons'); used to
// resolve `c:<file>` hashes for commons-linked rows and multi-file links alike.
async function loadCommonsExtMap(): Promise<Map<number, string>> {
  const res = await db.execute(
    sql`SELECT artwork_id, external_id FROM artwork_external_ids WHERE provider = 'commons'`,
  );
  const rows = ((res as unknown as { rows?: { artwork_id: number; external_id: string }[] }).rows ??
    (res as unknown as { artwork_id: number; external_id: string }[]));
  const map = new Map<number, string>();
  for (const r of rows) {
    if (!map.has(r.artwork_id)) map.set(r.artwork_id, r.external_id.replace(/^commons:/, ''));
  }
  return map;
}

function loadCommonsHashes(): Record<string, string | null> {
  if (!existsSync(COMMONS_HASH_OUT)) throw new Error(`commons hash state missing ${COMMONS_HASH_OUT} — run the commons adapter's hash mode first, no fallback`);
  return JSON.parse(readFileSync(COMMONS_HASH_OUT, 'utf8')) as Record<string, string | null>;
}

// Resolution order for a tracked row's dHash: its own `w:<id>` (wikiart) or `c:<file>`
// (commons) from the shared Commons run, else a fresh `t:<id>` computed by this adapter's
// hash mode. Returns null when the row cannot be hashed (import aborts on those).
function reuseTrackedHash(
  t: TrackedRow,
  commonsHashes: Record<string, string | null>,
  extMap: Map<number, string>,
  pinterestHashes: Record<string, string | null>,
): string | null {
  if (t.provider === 'wikiart') {
    const h = commonsHashes[`w:${t.id}`];
    if (h) return h;
  }
  const file = extMap.get(t.id);
  if (file) {
    const h = commonsHashes[`c:${file}`];
    if (h) return h;
  }
  const fresh = pinterestHashes[`t:${t.id}`];
  return fresh ?? null;
}

async function urls(): Promise<void> {
  const { kept: items } = partitionExcluded(loadItems());
  const { tracked } = await loadArtistAndTracked();
  const commonsHashes = loadCommonsHashes();
  const extMap = await loadCommonsExtMap();
  const pinterestHashes = existsSync(HASH_OUT) ? (JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>) : {};

  const pinInput = items.map((i) => ({ key: `p:${i.src}`, url: i.url }));
  const trackedInput: { key: string; url: string }[] = [];
  let reused = 0;
  for (const t of tracked) {
    if (!t.imageUrl) throw new Error(`tracked row ${t.id} "${t.title}" has no image_url — cannot hash, no fallback`);
    if (reuseTrackedHash(t, commonsHashes, extMap, pinterestHashes)) {
      reused += 1;
      continue;
    }
    trackedInput.push({ key: `t:${t.id}`, url: t.imageUrl });
  }
  const input = [...pinInput, ...trackedInput];
  writeFileSync(HASH_IN, JSON.stringify(input, null, 2));
  console.log(`URLS done: pins=${pinInput.length} trackedFresh=${trackedInput.length} trackedReused=${reused} -> ${HASH_IN}`);
}

async function hash(): Promise<void> {
  if (!existsSync(HASH_IN)) throw new Error(`hash input missing ${HASH_IN} — run urls first, no fallback`);
  const input = JSON.parse(readFileSync(HASH_IN, 'utf8')) as { key: string; url: string }[];
  const out = existsSync(HASH_OUT) ? (JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>) : {};
  const missing = input.filter((e) => out[e.key] === undefined);
  mkdirSync(HASH_CACHE, { recursive: true });
  const jobs: { key: string; path: string }[] = [];
  const failedDl: string[] = [];
  let dl = 0;
  for (const e of missing) {
    const path = join(HASH_CACHE, `${createHash('sha1').update(e.key).digest('hex').slice(0, 20)}.img`);
    if (!existsSync(path)) {
      let lastErr = 'not attempted';
      let done = false;
      for (const wait of [0, 15000, 45000, 90000]) {
        if (wait) {
          console.log(`  backoff ${wait / 1000}s (${lastErr}) for ${e.key}`);
          await sleep(wait);
        }
        try {
          const res = await fetch(e.url, { headers: { 'user-agent': UA, accept: 'image/*,*/*' } });
          if (!res.ok) {
            lastErr = `status=${res.status}`;
            if (res.status === 404) break; // permanent — no retry burn
            continue;
          }
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 500) {
            lastErr = `body ${buf.length} bytes`;
            continue;
          }
          writeFileSync(path, buf);
          done = true;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err.message : String(err);
        }
      }
      if (!done) {
        console.error(`  download FAILED ${e.key}: ${lastErr}`);
        failedDl.push(e.key);
        continue;
      }
    }
    jobs.push({ key: e.key, path });
    console.log(`  dl ${++dl}/${missing.length}: ${e.key}`);
    if (dl < missing.length) await sleep(800); // i.pinimg.com CDN — light pacing
  }
  if (jobs.length > 0) {
    writeFileSync(HASH_JOBS, JSON.stringify(jobs, null, 2));
    const res = spawnSync('pwsh', ['-NoProfile', '-File', HASH_PS1, '-JobsPath', HASH_JOBS, '-OutPath', HASH_JOBS_OUT], {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    if (res.status !== 0) throw new Error(`hash script FAILED status=${res.status} — no fallback`);
    if (!existsSync(HASH_JOBS_OUT)) throw new Error(`hash jobs output missing ${HASH_JOBS_OUT} — no fallback`);
    Object.assign(out, JSON.parse(readFileSync(HASH_JOBS_OUT, 'utf8')) as Record<string, string | null>);
    writeFileSync(HASH_OUT, JSON.stringify(out, null, 2));
  }
  const failed = input.filter((e) => !out[e.key]).map((e) => e.key);
  for (const k of failed) console.error(`HASH-FAILED ${k} — image unreadable/undownloaded`);
  console.log(`HASH done: total=${input.length} missing=${missing.length} failed=${failed.length} -> ${HASH_OUT}`);
  if (failedDl.length > 0) {
    throw new Error(`image downloads FAILED for ${failedDl.length}/${missing.length} — completed hashes persisted, re-run after cooldown - no fallback`);
  }
}

// ---- import ----

async function runImport(apply: boolean): Promise<void> {
  const scrapeFile = loadScrape();
  const { kept: items, excluded: excludedItems } = partitionExcluded(loadItems());
  // Junk-list re-check (2026-10-15): the scrape JSON caches captions parsed by whatever junk
  // list was live when the scrape ran, so a rule added afterward never reaches its pins on
  // import. Re-classify here — the import is the enforcement point — and drop any cached
  // title whose fold the current list rejects. Year handling mirrors parseCaption: a junk
  // caption can still date the image unless the rule says dropYear.
  const rejunked: string[] = [];
  for (const it of items) {
    if (!it.title) continue;
    const j = junkReason(it.title);
    if (!j) continue;
    rejunked.push(`${it.file} "${it.title}" — ${j.reason}`);
    it.title = '';
    if (j.dropYear) it.year = null;
  }
  if (rejunked.length > 0) {
    console.log(`JUNK-IMPORT ${rejunked.length} cached caption(s) rejected by the current junk list:`);
    for (const r of rejunked) console.log(`JUNK-IMPORT ${r}`);
  }
  if (!existsSync(HASH_OUT)) throw new Error(`pin hash state missing ${HASH_OUT} — run urls + hash first, no fallback`);
  const hashes = JSON.parse(readFileSync(HASH_OUT, 'utf8')) as Record<string, string | null>;
  const commonsHashes = loadCommonsHashes();
  const extMap = await loadCommonsExtMap();
  const { artistRow, tracked } = await loadArtistAndTracked();
  const trackedById = new Map(tracked.map((t) => [t.id, t]));

  // Stage B needs the FULL tracked target set hashed — a missing row could silently let a
  // pin of that work insert as a duplicate. Resolve every row or abort (no fallback).
  const trackedHash = new Map<number, string>();
  const missingTracked: string[] = [];
  for (const t of tracked) {
    const h = reuseTrackedHash(t, commonsHashes, extMap, hashes);
    if (h) trackedHash.set(t.id, h);
    else missingTracked.push(`${t.id} "${t.title}" (${t.provider})`);
  }
  if (missingTracked.length > 0) {
    throw new Error(`tracked hash missing for ${missingTracked.length} row(s): ${missingTracked.join(' | ')} — run urls + hash first; matching without the full target set could insert a duplicate`);
  }

  // Band safety over EVERY tracked row (Stage B matches against all of them): any pair at
  // <= MATCH_MAX must be a documented composition twin or apply refuses.
  const th = [...trackedHash.entries()];
  let floor = 64;
  let floorPair = '';
  const closePairs: { pair: string; d: number }[] = [];
  for (let i = 0; i < th.length; i += 1) {
    for (let j = i + 1; j < th.length; j += 1) {
      const d = hammingBits(th[i]![1], th[j]![1]);
      const pair = `${Math.min(th[i]![0], th[j]![0])}:${Math.max(th[i]![0], th[j]![0])}`;
      if (d < floor) {
        floor = d;
        floorPair = pair;
      }
      if (d <= MATCH_MAX) closePairs.push({ pair, d });
    }
  }
  console.log(`tracked↔tracked unrelated floor = ${floor} (pair ${floorPair}, n=${th.length} hashed tracked rows)`);
  for (const cp of closePairs) {
    const known = KNOWN_TRACKED_TWINS[cp.pair];
    if (known) {
      console.log(`KNOWN-TWIN ${cp.pair} dist=${cp.d} — ${known}`);
    } else if (apply) {
      throw new Error(`band check FAILED: tracked pair ${cp.pair} sits at dist ${cp.d} <= MATCH_MAX=${MATCH_MAX} with no KNOWN_TRACKED_TWINS entry — bands unsafe for this corpus, refusing to apply`);
    } else {
      console.error(`FLOOR-VIOLATION ${cp.pair} dist=${cp.d} — apply will abort unless this pair is adjudicated into KNOWN_TRACKED_TWINS`);
    }
  }

  // already-linked pin items + pre-claimed tracked rows. Both stages skip `already` items,
  // so claims must be re-seeded from the DB or a re-run releases the row the previous run
  // linked and the next pin at dist <= MATCH_MAX lands on it instead of in dup-target
  // (the 2026-10-08 Stålenhag by_conception fix — same trap here).
  const execRes = await db.execute(
    sql`SELECT external_id, artwork_id FROM artwork_external_ids WHERE provider = 'pinterest'`,
  );
  const execRows = ((execRes as unknown as { rows?: { external_id: string; artwork_id: number }[] }).rows ??
    (execRes as unknown as { external_id: string; artwork_id: number }[]));
  const already = new Set(execRows.map((r) => r.external_id));
  const trackedClaimed = new Set<number>();
  for (const r of execRows) if (trackedById.has(r.artwork_id)) trackedClaimed.add(r.artwork_id);

  const decisions = new Map<string, Decision>();
  const extId = (src: string) => `${PROVIDER}:${src}`;
  const itemHash = (src: string): string | null => hashes[`p:${src}`] ?? null;
  // title-matched hash distances (printed as a distribution so the bands can be verified
  // against real data before --apply)
  const titleMatchDists: number[] = [];

  // Stage A: exact normalized title + tolerant year over EVERY tracked row.
  // A title match whose hash still agrees (<= TITLE_CONFLICT_MAX) attaches even when the
  // row already carries a Pinterest source — that is the multi-source feature, not a
  // conflict (several separate photos of one painting all belong on one artwork).
  // dup-target survives here only when no hash exists to verify the claim; hash-ONLY second
  // claims stay held in Stage B (the Stålenhag by_conception rule).
  for (const item of items) {
    if (already.has(extId(item.src)) || !item.title) continue;
    const nt = normTitle(item.title);
    const cands = tracked.filter((t) => normTitle(t.title) === nt && yearsCompat(t.year, item.year));
    const oh = itemHash(item.src);
    const dTo = (id: number): number | null => {
      const h = trackedHash.get(id);
      return oh && h ? hammingBits(oh, h) : null;
    };
    if (cands.length === 1) {
      const target = cands[0]!;
      const d = dTo(target.id);
      if (d != null && d > TITLE_CONFLICT_MAX) {
        decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: target.id, file: item.file }], conflictDist: d });
        console.log(`AMBIGUOUS-TITLE ${item.file} "${item.title}" -> ${target.id} hash dist ${d} > ${TITLE_CONFLICT_MAX} — hold`);
      } else if (d == null && trackedClaimed.has(target.id)) {
        decisions.set(item.src, { type: 'dup-target', wikiId: target.id, dist: -1 });
      } else {
        trackedClaimed.add(target.id);
        decisions.set(item.src, { type: 'title', wikiId: target.id, confidence: 100 });
        if (d != null) titleMatchDists.push(d);
        console.log(`TITLE ${item.file} "${item.title}" -> tracked ${target.id}${d != null ? ` (hash=${d})` : ' (no pin hash)'}`);
      }
    } else if (cands.length > 1) {
      // two tracked rows share this title — only the hash may pick; without exactly one
      // <= MATCH_MAX candidate the item is held for review.
      const scored = cands.map((c) => ({ id: c.id, dist: dTo(c.id) }));
      const unknown = scored.some((s) => s.dist == null);
      const close = scored.filter((s) => s.dist != null && s.dist <= MATCH_MAX);
      if (!unknown && close.length === 1) {
        const best = close[0]!;
        trackedClaimed.add(best.id);
        decisions.set(item.src, { type: 'title', wikiId: best.id, confidence: 100 });
        if (best.dist != null) titleMatchDists.push(best.dist);
        console.log(`TITLE-TIEBREAK ${item.file} -> tracked ${best.id} (shared title, hash=${best.dist})`);
      } else {
        decisions.set(item.src, { type: 'ambiguous-title', cands: cands.map((c) => ({ id: c.id, file: item.file })) });
        console.log(`AMBIGUOUS-TITLE ${item.file} "${item.title}" matches ${cands.length} tracked rows — hold`);
      }
    }
    // 0 candidates -> hash stage below
  }

  // Stage B: dHash against every tracked row.
  for (const item of items) {
    if (decisions.has(item.src) || already.has(extId(item.src))) continue;
    // F7: vision-adjudicated donor pins — the verdict decides, never the distance. Dist is
    // computed only to print alongside the verdict (the upload is a re-photo of a print).
    const donor = HASH_DONORS[item.src];
    if (donor) {
      const ohD = itemHash(item.src);
      const thD = trackedHash.get(donor.artworkId);
      const dist = ohD && thD ? hammingBits(ohD, thD) : -1; // -1 = nohash (same sentinel as L1032)
      if (trackedClaimed.has(donor.artworkId)) {
        decisions.set(item.src, { type: 'dup-target', wikiId: donor.artworkId, dist });
        console.log(`HASH-DONOR ${item.file} -> tracked ${donor.artworkId} but row already claimed — hold (by_conception rule) [${donor.why}]`);
      } else {
        trackedClaimed.add(donor.artworkId);
        decisions.set(item.src, { type: 'hash', wikiId: donor.artworkId, dist, confidence: 90, donor: donor.why });
        console.log(`HASH-DONOR ${item.file} -> tracked ${donor.artworkId} (forced link, dist=${dist === -1 ? 'nohash' : dist}) [${donor.why}]`);
      }
      continue;
    }
    const oh = itemHash(item.src);
    if (!oh) {
      decisions.set(item.src, { type: 'hold-nohash' });
      continue;
    }
    const dists = [...trackedHash.entries()]
      .map(([id, h]) => ({ id, dist: hammingBits(oh, h) }))
      .sort((a, b) => a.dist - b.dist);
    const best = dists[0] ?? null;
    const second = dists[1] ?? null;
    if (best && best.dist <= MATCH_MAX) {
      if (second && second.dist <= MATCH_MAX) {
        decisions.set(item.src, { type: 'ambiguous-hash', cands: [best, second].map((c) => ({ file: item.file, dist: c.dist })) });
        console.log(`AMBIGUOUS-HASH ${item.file} — ${best.dist}/${second.dist} to tracked ${best.id}/${second.id} — hold`);
      } else if (trackedClaimed.has(best.id)) {
        // A dup-target against a row THIS adapter inserted (provider 'pinterest') is the
        // C2 same-work case, not a by_conception second claim: the row's hash IS its
        // source pin's hash, so dist(item, row) == dist(item, pin) — pre-crash the two pins
        // would have grouped into one component (lead inserts, follower attaches). This is
        // what makes a partially-crashed --apply re-run idempotent: the stranded followers
        // re-attach as a second source instead of parking in the held pile.
        const targetRow = trackedById.get(best.id);
        if (targetRow?.provider === PROVIDER) {
          const ofSrc = targetRow.externalId.replace(/^pinterest:/, '');
          decisions.set(item.src, { type: 'pinterest-same', of: ofSrc });
          console.log(`PINTEREST-SAME ${item.file} = ${ofSrc} (dist=${best.dist} to inserted row ${best.id}) — re-attach as second source`);
        } else {
          decisions.set(item.src, { type: 'dup-target', wikiId: best.id, dist: best.dist });
          console.log(`DUP-TARGET ${item.file} — dist ${best.dist} to already-claimed tracked ${best.id} — hold (Stålenhag by_conception rule)`);
        }
      } else {
        trackedClaimed.add(best.id);
        decisions.set(item.src, { type: 'hash', wikiId: best.id, dist: best.dist, confidence: 90 });
        console.log(`HASH ${item.file} -> tracked ${best.id} (dist=${best.dist})`);
      }
    } else if (best && best.dist <= NEAR_MAX) {
      decisions.set(item.src, { type: 'near', best, second });
      console.log(`NEAR ${item.file} — dist ${best.dist} to tracked ${best.id} — hold for review`);
    } else {
      decisions.set(item.src, { type: 'new' });
    }
  }

  // Attribution gate BEFORE the same-work stages: a cluster lead must be insertable, so only
  // captioned (Schikaneder-named) pins stay `new`. A board-only pin with no match is held
  // loud — it may be a genuine Jakub work none of the six captions bothered to credit, but
  // it is never inserted blind (the captionless-stray risk on these boards: Josef Mandl
  // works wander onto barnett6115's board).
  for (const item of items) {
    const d = decisions.get(item.src);
    if (d?.type === 'new' && !item.attributed) {
      decisions.set(item.src, { type: 'no-attribution' });
      console.log(`NO-ATTRIBUTION ${item.file} — board-only pin, no caption names Schikaneder — held, never inserted`);
    }
  }

  // Follow pinterest-same chains to the artwork row that will exist for an item.
  const primaryOf = (src: string): string => {
    let cur = src;
    for (let guard = 0; guard < 20; guard += 1) {
      const d = decisions.get(cur);
      if (d?.type === 'pinterest-same') cur = d.of;
      else return cur;
    }
    throw new Error(`pinterest-same chain too deep at ${src}`);
  };
  // Holding a primary must hold every item linked to it: pass 3 resolves pinterest-same
  // targets by (provider, external_id) of the PRIMARY, so a held primary would strand its
  // followers (the pass-3 lookup throws loudly). Cascade the hold down the chain instead.
  // holdDecision names the CONFLICTING item (the reason everything got held), never the
  // held item itself.
  const cascadeHold = (rootSrc: string, holdDecision: Decision) => {
    const root = primaryOf(rootSrc);
    for (const it of items) {
      const d = decisions.get(it.src);
      if (d?.type === 'pinterest-same' && primaryOf(it.src) === root) decisions.set(it.src, holdDecision);
    }
    const rd = decisions.get(root);
    if (rd?.type === 'new' || rd?.type === 'pinterest-same') decisions.set(root, holdDecision);
  };

  // Stage C1: same-work clusters among pin items — title+year agree and the hash confirms
  // (<= MATCH_MAX) -> the later item links to the earlier one's artwork row. Title agrees
  // but the hash disagrees -> BOTH held (either two works sharing a title or two wildly
  // different captures of one work — never guess which). One hash missing -> hold the later
  // item as unproven, the earlier stays insertable as primary.
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const di = decisions.get(item.src);
    if (!di || di.type !== 'new' || !item.title) continue;
    for (let j = 0; j < i; j += 1) {
      const prior = items[j]!;
      const pd = decisions.get(prior.src);
      if (!pd || (pd.type !== 'new' && pd.type !== 'pinterest-same') || !prior.title) continue;
      if (normTitle(prior.title) !== normTitle(item.title) || !yearsCompat(prior.year, item.year)) continue;
      const target = primaryOf(prior.src);
      const ha = itemHash(item.src);
      const hb = itemHash(target);
      if (ha && hb) {
        const d = hammingBits(ha, hb);
        if (d <= MATCH_MAX) {
          decisions.set(item.src, { type: 'pinterest-same', of: target });
          console.log(`PINTEREST-SAME ${item.src} = ${target} (title+year, dist=${d})`);
        } else {
          console.error(`TITLE-VISUAL-CONFLICT ${target} ~ ${item.file} dist=${d} — both held`);
          cascadeHold(target, { type: 'ambiguous-title', cands: [{ id: -1, file: item.file }], conflictDist: d });
          decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: -1, file: target }], conflictDist: d });
        }
      } else {
        decisions.set(item.src, { type: 'ambiguous-title', cands: [{ id: -1, file: target }] });
      }
      break;
    }
  }

  // Stage C2: near-identical visuals under different titles among would-be-new works
  // (same piece under two image paths — re-uploads/repin variants). Every `new` member is
  // already proven > NEAR_MAX from every tracked row (Stage B), so an identical component
  // cannot duplicate tracked work — adjudicate instead of holding: the first member in
  // scrape order is the lead and inserts, every other member attaches to it as a second
  // source. Components handle 3+-item clusters: one lead per component keeps exactly one
  // artwork.
  const newItems = items.filter((i) => decisions.get(i.src)?.type === 'new');
  const parent = new Map<string, string>();
  for (const i of newItems) parent.set(i.src, i.src);
  const findRoot = (s: string): string => {
    let r = s;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = s;
    while (parent.get(c) !== c) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const pairCand = new Map<string, { file: string; dist: number }>(); // member -> first conflicting partner
  for (let i = 0; i < newItems.length; i += 1) {
    for (let j = i + 1; j < newItems.length; j += 1) {
      const a = newItems[i]!;
      const b = newItems[j]!;
      const ha = itemHash(a.src);
      const hb = itemHash(b.src);
      if (!ha || !hb) continue;
      const d = hammingBits(ha, hb);
      if (d <= MATCH_MAX) {
        const ra = findRoot(a.src);
        const rb = findRoot(b.src);
        if (ra !== rb) parent.set(ra, rb);
        if (!pairCand.has(a.src)) pairCand.set(a.src, { file: b.file, dist: d });
        if (!pairCand.has(b.src)) pairCand.set(b.src, { file: a.file, dist: d });
      }
    }
  }
  const compMembers = new Map<string, string[]>(); // component root -> member srcs (items order)
  for (const i of newItems) {
    const r = findRoot(i.src);
    const list = compMembers.get(r);
    if (list) list.push(i.src);
    else compMembers.set(r, [i.src]);
  }
  const bySrc = new Map(items.map((i) => [i.src, i]));
  for (const [, members] of compMembers) {
    if (members.length < 2) continue;
    // F9: the lead should carry a real title so the inserted row gets one; first TITLED
    // member in items order, else the first member (bare-path title). Skip the lead by
    // identity — slice(1) would re-include it when it was found past index 0 (self-loop).
    const lead = members.find((s) => (bySrc.get(s)?.title ?? '') !== '') ?? members[0]!;
    const leadItem = bySrc.get(lead)!;
    for (const src of members) {
      if (src === lead) continue;
      const member = bySrc.get(src)!;
      const cand = pairCand.get(src);
      console.error(`DUP-PINTEREST ${member.file} ~ ${leadItem.file} dist=${cand?.dist ?? '?'} — same work: lead inserts, follower attaches (${members.length}-item component)`);
      decisions.set(src, { type: 'pinterest-same', of: lead });
    }
  }

  // Stage C3: a held no-attribution pin that is image-identical (<= MATCH_MAX) to a decided
  // item inherits that item's target — attribution comes from the captioned twin, so the
  // board-only repin attaches as a second source instead of sitting in the held pile. This
  // is image identity against an already-decided SAME-SOURCE item, never a blind guess.
  for (const item of items) {
    const d = decisions.get(item.src);
    if (d?.type !== 'no-attribution') continue;
    const ha = itemHash(item.src);
    if (!ha) continue;
    for (const other of items) {
      if (other.src === item.src) continue;
      const od = decisions.get(other.src);
      const otherDecided =
        already.has(extId(other.src)) ||
        (od != null && (od.type === 'title' || od.type === 'hash' || od.type === 'pinterest-same' || od.type === 'new'));
      if (!otherDecided) continue;
      const hb = itemHash(other.src);
      if (!hb) continue;
      const dd = hammingBits(ha, hb);
      if (dd <= MATCH_MAX) {
        decisions.set(item.src, { type: 'pinterest-same', of: primaryOf(other.src) });
        console.log(`NO-ATTRIBUTION-RESOLVED ${item.src} = ${other.src} (dist=${dd}, attribution inherited from the captioned twin)`);
        break;
      }
    }
  }

  // ---------------- verdict replay (2026-10-15 held-pin adjudication) ----------------
  // Every held pin was adjudicated by direct side-by-side image comparison of the transient
  // downloads (refs-only — nothing stored). A verdict rewrites ONLY a held decision; a
  // confident title/hash/pinterest-same decision is never overridden, so a pin whose junk
  // caption was stripped and which then resolved itself keeps that link — every auto-resolved
  // pin lands on the same target the verdict names. DROP verdicts land in their own bucket
  // and are never written by any apply pass.
  const HELD_TYPES = new Set(['ambiguous-title', 'ambiguous-hash', 'near', 'dup-target', 'hold-nohash', 'no-attribution']);
  const VERDICT_LINK: Record<string, number> = {
    'originals/0a/9b/ce/0a9bce2c3d20d6d4dfd7063aa43996c3.jpg': 194342, // pin 01
    'originals/14/9e/6b/149e6b59b7aceaa672c2be73cd4a1f3a.jpg': 194327, // pin 03
    'originals/1d/14/a6/1d14a6cbcdd35eb04135c7755c154f7e.jpg': 194342, // pin 04
    'originals/2a/5c/7d/2a5c7dfaf2275688f0a6e0f4a1e37f99.jpg': 194327, // pin 05
    'originals/2e/ab/7b/2eab7ba7028201551c0d07f602e505d2.jpg': 171233, // pin 06
    'originals/47/a7/27/47a72719cc2eed2e5920acc991a74660.jpg': 194342, // pin 07
    'originals/48/14/46/481446974b80632462a0e7da79067081.jpg': 194346, // pin 08
    'originals/4a/98/45/4a9845efe76c5115782e57faf856a8c4.jpg': 194342, // pin 09
    'originals/4b/34/98/4b34986da488ac3f867b985c3d734e18.jpg': 194359, // pin 10
    'originals/4b/cd/79/4bcd7901473b70c43db7a26cbc771908.jpg': 194354, // pin 11
    'originals/56/2b/4b/562b4bfb1b40583b6e4c7f89f98c401c.jpg': 194359, // pin 12
    'originals/5d/10/99/5d1099fd065f77bf6ea63c7a66ca2c13.jpg': 171244, // pin 13
    'originals/5f/03/06/5f030659fce4bbdf2b1102fa579035a4.jpg': 194361, // pin 14
    'originals/64/05/3e/64053e60390c92ea851010e78e1a66bd.jpg': 194361, // pin 15
    'originals/73/65/d8/7365d86fb7512ad53eea19f2107ccc44.jpg': 194354, // pin 17
    'originals/75/d0/74/75d074e9b82efa0683289c06f69eed00.jpg': 194354, // pin 18
    'originals/77/85/82/77858208b92d706f0f4b4ccd8ebfaa16.jpg': 171234, // pin 19
    'originals/7b/18/da/7b18dad2b2f606e7a5a442961bddc7a5.jpg': 194342, // pin 20
    'originals/84/bd/fe/84bdfedafdaeb5690cb6d8ae93082a9a.jpg': 171247, // pin 21
    'originals/84/e4/c6/84e4c677271750148a8cdc60a1647de8.jpg': 171243, // pin 22
    'originals/8f/b1/90/8fb19089d808f27da0eaeeda38c86b7f.jpg': 194359, // pin 23
    'originals/90/b1/30/90b13051764772ab6cba2ce6811ead0d.jpg': 171249, // pin 24
    'originals/97/cf/b7/97cfb7db4f6010c3dfa6851a211952e8.jpg': 194342, // pin 26
    'originals/9f/41/c9/9f41c967ddfe8b4cfae4502ab4dd2afb.jpg': 194326, // pin 27
    'originals/d3/62/18/d362181c22d28b91e2f326ac7f76d2d0.jpg': 194361, // pin 30
    'originals/d3/80/97/d38097d3b004fde4a2f3dab605198abe.jpg': 194342, // pin 31
    'originals/df/a6/67/dfa667bdb2ef4af851bee9cad09bc6f8.jpg': 194361, // pin 32
    'originals/e1/28/7f/e1287f7f62f3e36170cad2ae3d931d9d.jpg': 194361, // pin 33
    'originals/e1/a7/e2/e1a7e258560ac67071ce82123fa07b03.jpg': 194328, // pin 34
    'originals/e5/4e/d6/e54ed69465ed320461782ec8054af5f1.jpg': 194361, // pin 35
    'originals/e5/a5/b1/e5a5b1ef2b543518aa3d3b428bee29e5.jpg': 194348, // pin 36
    'originals/f3/60/33/f360336f747e9ab17e1e3b98d308e0cf.jpg': 171248, // pin 37
    'originals/38/9e/69/389e696ef8e1fc6d4772a1a8eeaff97a.jpg': 171230, // pin 38
    'originals/43/86/99/4386999178c17a2131df6cd5b6305514.jpg': 194415, // pin 39
    'originals/66/0a/6f/660a6ff415d3df941037fb09b10d7d2c.jpg': 194415, // pin 41
    'originals/a2/43/40/a2434067d0c88afa5e09dea12bd9586f.jpg': 194351, // pin 42
    'originals/c4/a0/14/c4a014ddf662330df2ff0aa71eed0e0e.jpg': 194367, // pin 44
    'originals/d1/58/7a/d1587a20c75e8c509929a7824508c501.jpg': 171251, // pin 46
    'originals/a3/36/8c/a3368c06adae58019561917809e9ab92.jpg': 194327, // pin 56
    'originals/0a/a9/be/0aa9be89f490012c758e2a75d00b494a.jpg': 194346, // dup 1
    'originals/0c/28/99/0c289996944fa14c23cb757bb5a410a5.jpg': 194352, // dup 2
    'originals/12/47/b3/1247b3460b4bdb0bff7dfebbc01edd62.jpg': 171249, // dup 3
    'originals/13/f3/f1/13f3f18ea68a643331338b14621733ff.jpg': 171232, // dup 4
    'originals/17/6c/b8/176cb83c903755e102c2874786e97ccc.jpg': 171243, // dup 5
    'originals/1e/52/38/1e52382b11c5a35643d0f979f82be2bd.jpg': 171230, // dup 6
    'originals/23/aa/3a/23aa3a541c350b6dfe9078b43b262df1.jpg': 194354, // dup 7
    'originals/25/70/60/257060af192500371e10a6d8138869af.jpg': 171243, // dup 8
    'originals/2b/6d/37/2b6d37c944762af5f88f73a4175d8f40.jpg': 171237, // dup 9
    'originals/2b/f5/af/2bf5af3f58f2f61aeef7bd153dc52f8f.jpg': 171231, // dup 10
    'originals/31/5b/3a/315b3a3fc9f702d46e41b5010b5ca19b.jpg': 194346, // dup 11
    'originals/3a/9d/db/3a9ddbbecbea346058dedb76eca066b8.jpg': 194357, // dup 12
    'originals/3b/fe/c5/3bfec5f4d65d06eb190931e7e3d9d727.jpg': 171237, // dup 13
    'originals/3d/09/10/3d0910359a270202b4abb7bd1f6fd549.jpg': 194354, // dup 14
    'originals/4a/38/8d/4a388d76ceb3903360e098c88fdc2b15.jpg': 171237, // dup 15
    'originals/4c/aa/65/4caa65c5a171d6d0623ca5dac129e9eb.jpg': 171230, // dup 16
    'originals/55/d4/4d/55d44d4bcc8d9aaaa854ee2f07d898f5.jpg': 171243, // dup 17
    'originals/59/a1/b7/59a1b70c3756de9ca7e6ae988105adf5.jpg': 194346, // dup 18
    'originals/62/98/57/6298575a0ba7d2745527e1f868d9a7c9.jpg': 194352, // dup 19
    'originals/62/cf/4c/62cf4c40c380d99615dbbd69c8883add.jpg': 171229, // dup 20
    'originals/64/e9/b6/64e9b6f55a27eb30af57e9ff94c4f827.jpg': 194354, // dup 21
    'originals/65/7c/d0/657cd09f89fe022dd7ee9049a01625b3.jpg': 171247, // dup 22
    'originals/6d/02/84/6d0284c0fa198b37b62a6ebea0f17f7e.jpg': 171244, // dup 23
    'originals/71/1b/c2/711bc2ff63fdeb6cfebd960acfaf0335.jpg': 194357, // dup 24
    'originals/78/ff/45/78ff454ce4cc6efcb063e040993436f5.jpg': 171231, // dup 25
    'originals/7f/aa/3b/7faa3b535e8b4389f6a57fd3a1d70db4.jpg': 194330, // dup 26
    'originals/82/06/94/82069413a6f002231ed0a433b7a4ab1c.jpg': 194346, // dup 27
    'originals/84/a4/ed/84a4edf2947df26cf21aeedf0bc44a7e.jpg': 171232, // dup 28
    'originals/85/de/45/85de45c2de2251e06e40af466bea0b68.jpg': 171236, // dup 29
    'originals/8a/4a/6e/8a4a6e230a3ecae5be11e0c524746788.jpg': 171233, // dup 30
    'originals/91/a0/84/91a084f86707f127a33b8582c8494e2a.jpg': 194345, // dup 31
    'originals/97/87/2a/97872ad9bb7ebcc52eb183dc5653f8e8.jpg': 171244, // dup 32
    'originals/a1/71/de/a171de66d3066836c70feee74e2b9642.jpg': 171231, // dup 33
    'originals/a4/9b/cc/a49bccc71c84cf24252e47d262629bb0.jpg': 171235, // dup 34
    'originals/a6/03/bb/a603bbc54226134b6afcb6db6e2848aa.jpg': 171244, // dup 35
    'originals/a8/52/17/a852177cde02773c9f535b7e8fd93f51.jpg': 171228, // dup 36
    'originals/b0/54/65/b0546537912e6e41e15d8766e3edac98.jpg': 171235, // dup 37
    'originals/b0/55/a8/b055a81edaba70dd6bdf96452f449dd4.jpg': 171249, // dup 38
    'originals/b2/79/de/b279de392a98b55ec1a9bbedcfb4dcbf.jpg': 194346, // dup 39
    'originals/b5/f1/b6/b5f1b6d24c44d0aa0f7b55b3fdf5ee57.jpg': 171235, // dup 40
    'originals/b8/1d/59/b81d595ef6d1f683c73a1f5afe038e36.jpg': 171231, // dup 41
    'originals/bb/d0/1c/bbd01cfe2deab8f5719f2dd8d588ecbe.jpg': 171234, // dup 42
    'originals/be/e4/91/bee49136937c736fe518727b30d4972d.jpg': 171244, // dup 43
    'originals/bf/88/5d/bf885d71f6398cc336b665b3906e1315.jpg': 171235, // dup 44
    'originals/c3/34/54/c3345483de2b19e14f137d7eb963f9e4.jpg': 171235, // dup 45
    'originals/c3/45/62/c345628bdb726ea22d33248c9ce83bb9.jpg': 171230, // dup 46
    'originals/c5/f1/42/c5f1422a78d7c91d16479cd2fb96203f.jpg': 171239, // dup 47
    'originals/ca/af/d5/caafd5b3642cdc69cd89062cedd760bc.jpg': 194333, // dup 48
    'originals/cf/ce/a7/cfcea71efb014c18e71f3c054e8ab2d5.jpg': 171230, // dup 49
    'originals/d6/60/cc/d660cc4188988d1c3ebff7a4b83fe15f.jpg': 171237, // dup 50
    'originals/d6/b5/14/d6b514dab15a3c84116479166be33e6e.jpg': 171244, // dup 51
    'originals/db/87/4e/db874ed31a6043a923c28d4a1a52083a.jpg': 171231, // dup 52
    'originals/de/1f/a2/de1fa226d8d5ab7390ee911e9c3ad9d3.jpg': 171244, // dup 53
    'originals/e4/c6/37/e4c6377241a01e5c2bfee0678383c083.jpg': 171228, // dup 54
    'originals/e5/dc/2e/e5dc2e062c2b8548949b2d024bd640fe.jpg': 194326, // dup 55
    'originals/e5/f3/ff/e5f3ff677fc885c74776259b3558a44f.jpg': 194356, // dup 56
    'originals/e6/b3/1d/e6b31dee2398306c31b49f361e02345b.jpg': 171245, // dup 57
    'originals/e8/a3/fa/e8a3fa5940da024c5dffe4379e51f506.jpg': 194352, // dup 58
    'originals/eb/22/8a/eb228ab9fbb1743b045c0e7ebd94976e.jpg': 171228, // dup 59
    'originals/ed/79/98/ed799879f2497f38d0e0eabc200475eb.jpg': 171239, // dup 60
    'originals/f3/7f/3e/f37f3e54f830a2b24edae08dd6907643.jpg': 171243, // dup 61
    'originals/f3/df/07/f3df071ed6152c75799725aea3771901.jpg': 194352, // dup 62
    'originals/f6/54/e2/f654e26bd66494a4c77878da9f2673cc.jpg': 171249, // dup 63
    'originals/f6/e4/82/f6e482c64da1aca9874ddcc8b649ca20.jpg': 171229, // dup 64
    'originals/f7/d5/60/f7d560f11a608a4f6cba162824a738d6.jpg': 171244, // dup 65
    'originals/fa/68/c9/fa68c919db92de6a98d1de0d069dd581.jpg': 194326, // dup 66
    'originals/fc/56/41/fc5641bcc1c8aae0a7009b2082b20e54.jpg': 171231, // dup 67
    'originals/fd/6f/d2/fd6fd2520a202f98cd4b1c217fd98fee.png': 171231, // dup 68
    'originals/ff/d0/07/ffd007f037027735973a5fd0eb06d77b.jpg': 194354, // dup 69
  };
  const VERDICT_NEW = new Set<string>([
    'originals/0f/f3/e3/0ff3e367b84e248ebc31baa834a5ab90.jpg', // pin 02
    'originals/90/bc/a8/90bca870e26440a785676f4831c57789.jpg', // pin 25
    'originals/ce/6d/29/ce6d29734900429545ae650cd0f9dbea.jpg', // pin 29
    'originals/45/18/9c/45189c2b954a68b3e93a6bee4ab865ed.jpg', // pin 40
    'originals/b5/3b/84/b53b84835166dd8b1f7948735a8ae86d.jpg', // pin 43
    'originals/cd/1c/d1/cd1cd1e04ae07c417d20318b8c9dcfaf.jpg', // pin 45
    'originals/d8/6b/0e/d86b0ef41fa92e2bdbe26d17acaed807.jpg', // pin 47
    'originals/32/3e/2e/323e2e8f3a5ef0e0e525691b0fbf511b.jpg', // pin 48
    'originals/62/61/c5/6261c5cdf6fbf28b7a437c608b9d024a.jpg', // pin 52
    'originals/e1/2c/f5/e12cf50da4d375c9e053828c17fddae1.jpg', // pin 57
  ]);
  const VERDICT_DROP: Record<string, string> = {
    'originals/6e/45/7f/6e457fe3e388ab06dca1ebaac4b079c5.jpg': 'photograph, not an artwork', // pin 16
    'originals/c6/0c/b9/c60cb92ad699ea1a068e4cdb15c7f6a0.jpg': 'painting by another artist - no Schikaneder match', // pin 28
    'originals/38/e9/c1/38e9c1cb803e363e78b169a2cdfa586d.jpg': 'Peder Severin Kroyer painting - not Schikaneder', // pin 49
    'originals/3d/dc/95/3ddc95e9d037677a5c6c8c1a272950a1.jpg': 'photograph, not an artwork', // pin 50
    'originals/51/9b/a6/519ba6881ec162fb90437c140847382a.jpg': 'no matching Schikaneder work in the tracked set', // pin 51
    'originals/7a/27/7f/7a277f58b7a99713b3434486b4b90da2.jpg': 'no matching Schikaneder work in the tracked set', // pin 53
    'originals/7a/78/f2/7a78f26bdee081cd7a8154373dea8d3c.jpg': 'postage stamp / stamp-news graphic - not an artwork', // pin 54
    'originals/7a/ea/fe/7aeafeace2b80a2b857ea56eb85954ed.jpg': 'Henri Le Sidaner painting (caption names that artist) - not Schikaneder', // pin 55
    'originals/eb/e6/91/ebe691fc1a43217df3c6d7afe99b35c6.jpg': 'postage stamp - not an artwork', // pin 58
  };
  {
    const itemSrcs = new Set(items.map((i) => i.src));
    for (const src of [...Object.keys(VERDICT_LINK), ...VERDICT_NEW, ...Object.keys(VERDICT_DROP)]) {
      if (!itemSrcs.has(src) && !already.has(extId(src))) {
        throw new Error(`verdict src "${src}" is neither a scraped item nor an already-imported pin — the verdict map is stale, refusing to continue`);
      }
    }
  }
  let replayed = 0;
  for (const [src, target] of Object.entries(VERDICT_LINK)) {
    const d = decisions.get(src);
    if (!d || !HELD_TYPES.has(d.type)) continue;
    decisions.set(src, { type: 'hash', wikiId: target, dist: -1, confidence: 90, donor: 'image-verdict 2026-10-15 (held-pin adjudication)' });
    replayed += 1;
  }
  for (const src of VERDICT_NEW) {
    const d = decisions.get(src);
    if (!d || !HELD_TYPES.has(d.type)) continue;
    decisions.set(src, { type: 'new' });
    replayed += 1;
  }
  for (const [src, why] of Object.entries(VERDICT_DROP)) {
    const d = decisions.get(src);
    if (!d || !HELD_TYPES.has(d.type)) continue;
    decisions.set(src, { type: 'verdict-drop', why });
    replayed += 1;
  }
  console.log(`VERDICT-REPLAY ${replayed} held pin(s) rewritten (${Object.keys(VERDICT_LINK).length} link / ${VERDICT_NEW.size} new / ${Object.keys(VERDICT_DROP).length} drop verdicts on file)`);

  // ---------------- title plan ----------------
  // All titles for this artist must stay unique; same-named upstream titles get the
  // source's own identifier as suffix (commons title-plan rule) — identifiers only,
  // never invented words. Pin titles come from captions; captionless items carry the
  // bare image path (their only per-item identifier).
  const existingRows = (await db
    .select({
      id: artworks.id,
      title: artworks.title,
      provider: artworks.provider,
      paintingUrl: artworks.paintingUrl,
      externalId: artworks.externalId,
    })
    .from(artworks)
    .where(eq(artworks.artistId, artistRow.id))) as {
    id: number;
    title: string;
    provider: string;
    paintingUrl: string | null;
    externalId: string;
  }[];

  const identifierFor = (row: { provider: string; paintingUrl: string | null; externalId: string }): string => {
    if (row.provider === 'wikiart' && row.paintingUrl) {
      const segs = row.paintingUrl.replace(/\/+$/, '').split('/');
      const last = segs[segs.length - 1] ?? '';
      const slug = /^painting$/i.test(last) ? (segs[segs.length - 2] ?? row.externalId) : last;
      return slug;
    }
    if (row.provider === PROVIDER) return row.externalId.replace(/^pinterest:/, '').replace(/\.[A-Za-z]+$/, '');
    return row.externalId;
  };

  const plannedInserts = items.filter((i) => decisions.get(i.src)?.type === 'new');
  type Group = { existing: typeof existingRows; inserts: PinterestItem[] };
  const groups = new Map<string, Group>();
  for (const row of existingRows) {
    const k = normTitle(row.title);
    const g = groups.get(k) ?? { existing: [], inserts: [] };
    g.existing.push(row);
    groups.set(k, g);
  }
  for (const it of plannedInserts) {
    // F9: untitled inserts (no caption survived the junk gates) skip grouping entirely —
    // their title is the bare image path (extension stripped), the only identifier they
    // carry. They are excluded from the suffix wrap, and a bare-path title can never
    // collide with a real captioned title.
    if (!it.title) continue;
    const k = normTitle(it.title);
    const g = groups.get(k) ?? { existing: [], inserts: [] };
    g.inserts.push(it);
    groups.set(k, g);
  }

  const repairs: { id: number; from: string; to: string; why?: string }[] = [];
  const finalTitle = new Map<string, string>();
  for (const it of plannedInserts) {
    if (!it.title) finalTitle.set(it.src, it.file.replace(/\.[A-Za-z]+$/, ''));
  }
  for (const [, g] of groups) {
    const groupSize = g.existing.length + g.inserts.length;
    if (g.existing.length >= 2) {
      for (const row of g.existing) repairs.push({ id: row.id, from: row.title, to: `${row.title} (${identifierFor(row)})`, why: 'title shared by multiple items — identifier suffix' });
    }
    for (const it of g.inserts) {
      if (groupSize > 1) finalTitle.set(it.src, `${it.title} (${it.file.replace(/\.[A-Za-z]+$/, '')})`);
      else finalTitle.set(it.src, it.title);
    }
  }
  // Junk-title row repairs (2026-10-15): rows inserted by an earlier run under a caption the
  // junk list has since grown to recognize (its fold is a JUNK_TITLES member) get retitled to
  // their own bare-path identifier — the same shape freshly imported captionless pins carry.
  // Rows already repaired by the title-group pass above are left alone.
  for (const row of existingRows) {
    if (row.provider !== PROVIDER || repairs.some((r) => r.id === row.id)) continue;
    if (!JUNK_TITLES.has(normTitle(row.title))) continue;
    const to = identifierFor(row);
    repairs.push({ id: row.id, from: row.title, to, why: 'junk caption — retitled to the bare-path identifier (verdict batch 2026-10-15)' });
    console.log(`JUNK-TITLE-REPAIR artwork ${row.id}: "${row.title}" -> "${to}"`);
  }
  // Uniqueness pre-assert over every title we are about to have on record (existing after
  // repairs + planned inserts). Fail BEFORE any write.
  const finalKeys: string[] = [];
  for (const row of existingRows) {
    const rep = repairs.find((r) => r.id === row.id);
    finalKeys.push(normTitle(rep ? rep.to : row.title));
  }
  for (const it of plannedInserts) finalKeys.push(normTitle(finalTitle.get(it.src)!));
  const dupKeys = [...new Set(finalKeys.filter((k, i) => finalKeys.indexOf(k) !== i))];
  if (dupKeys.length > 0) {
    throw new Error(`title uniqueness pre-assert FAILED: ${dupKeys.length} duplicate normTitle key(s): ${dupKeys.join(' | ')}`);
  }

  // ---------------- report ----------------
  const buckets: Record<string, PinterestItem[]> = {
    title: [],
    hash: [],
    new: [],
    'pinterest-same': [],
    'ambiguous-title': [],
    'ambiguous-hash': [],
    near: [],
    'dup-target': [],
    'hold-nohash': [],
    'no-attribution': [],
    'verdict-drop': [],
  };
  const skipped = items.filter((i) => already.has(extId(i.src)));
  for (const item of items) {
    if (already.has(extId(item.src))) continue;
    const d = decisions.get(item.src);
    if (d) buckets[d.type].push(item);
  }
  const trackedOnly = tracked.filter((t) => !trackedClaimed.has(t.id));
  const claimedByOf = (src: string, wikiId: number): string => {
    const other = items.find((o) => {
      if (o.src === src || already.has(extId(o.src))) return false;
      const d = decisions.get(o.src);
      return (d?.type === 'title' || d?.type === 'hash') && d.wikiId === wikiId;
    });
    if (other) return other.src;
    const prior = execRows.find((r) => r.artwork_id === wikiId);
    return prior ? prior.external_id.replace(/^pinterest:/, '') : '(unknown)';
  };

  const heldCount =
    buckets['ambiguous-title'].length +
    buckets['ambiguous-hash'].length +
    buckets.near.length +
    buckets['dup-target'].length +
    buckets['hold-nohash'].length +
    buckets['no-attribution'].length;

  const lines: string[] = [];
  lines.push('# Jakub Schikaneder — Pinterest import report');
  lines.push('');
  for (const b of scrapeFile.boards) {
    lines.push(`- board ${b.url}: ${b.got}/${b.expect} pins${b.complete ? '' : ' — INCOMPLETE'}`);
  }
  lines.push(`- injected UI-module pins without images (contentless, excluded at scrape): ${scrapeFile.noOrig}`);
  lines.push(
    `- scrape candidates: ${items.length + excludedItems.length} (already imported: ${skipped.length}, excluded from matching: ${excludedItems.length})`,
  );
  lines.push(
    `- title matches: ${buckets.title.length}, hash matches (<=${MATCH_MAX}): ${buckets.hash.length}, same-work twins: ${buckets['pinterest-same'].length}, new works: ${buckets.new.length}`,
  );
  lines.push(
    `- HELD: ambiguous-title ${buckets['ambiguous-title'].length}, ambiguous-hash ${buckets['ambiguous-hash'].length}, near(<=${NEAR_MAX}) ${buckets.near.length}, dup-target ${buckets['dup-target'].length}, nohash ${buckets['hold-nohash'].length}, no-attribution ${buckets['no-attribution'].length}`,
  );
  if (buckets['verdict-drop'].length) {
    lines.push(`- verdict drops (adjudicated non-Schikaneder images, never applied): ${buckets['verdict-drop'].length}`);
  }
  lines.push(`- tracked works with no Pinterest counterpart: ${trackedOnly.length}`);
  lines.push(`- tracked↔tracked unrelated floor: ${floor} (bands: MATCH_MAX=${MATCH_MAX}, NEAR_MAX=${NEAR_MAX}, TITLE_CONFLICT_MAX=${TITLE_CONFLICT_MAX})`);
  if (titleMatchDists.length > 0) {
    const sorted = [...titleMatchDists].sort((a, b) => a - b);
    lines.push(`- title-matched hash distances (n=${sorted.length}): ${sorted.join(', ')}`);
  }
  lines.push('');
  if (excludedItems.length) {
    lines.push(`## EXCLUDED from matching (${excludedItems.length})`);
    for (const i of excludedItems) lines.push(`- ${i.file} — ${i.exclude}`);
    lines.push('');
  }
  if (closePairs.length) {
    lines.push(`## tracked-pair distances <= ${MATCH_MAX} (${closePairs.length})`);
    for (const cp of closePairs) {
      const known = KNOWN_TRACKED_TWINS[cp.pair];
      lines.push(`- ${cp.pair} dist=${cp.d}${known ? ` — KNOWN-TWIN: ${known}` : ' — FLOOR-VIOLATION (apply aborts)'}`);
    }
    lines.push('');
  }
  if (repairs.length) {
    lines.push(`## title repairs (${repairs.length})`);
    for (const r of repairs) lines.push(`- artwork ${r.id}: "${r.from}" -> "${r.to}"${r.why ? ` — ${r.why}` : ''}`);
    lines.push('');
  }
  const pushSection = (label: string, list: PinterestItem[], f: (i: PinterestItem, d: Decision) => string) => {
    if (!list.length) return;
    lines.push(`## ${label} (${list.length})`);
    for (const i of list) lines.push(`- ${f(i, decisions.get(i.src)!)}`);
    lines.push('');
  };
  pushSection('title matches', buckets.title, (i, d) => {
    const id = (d as { wikiId: number }).wikiId;
    const oh = itemHash(i.src);
    const whh = trackedHash.get(id);
    const hd = oh && whh ? hammingBits(oh, whh) : null;
    return `${i.file} -> tracked ${id} ("${trackedById.get(id)?.title}" ${trackedById.get(id)?.year ?? ''}, pin="${i.title}" ${i.year ?? ''}, yearSource=${i.yearSource}, hashDist=${hd ?? 'n/a'})`;
  });
  pushSection(`hash matches (dist<=${MATCH_MAX})`, buckets.hash, (i, d) => {
    const dd = d as { wikiId: number; dist: number; donor?: string };
    return `${i.file} -> tracked ${dd.wikiId} ("${trackedById.get(dd.wikiId)?.title}", pin="${i.title}" ${i.year ?? ''}, dist=${dd.dist < 0 ? 'n/a' : dd.dist})${dd.donor ? ` — DONOR: ${dd.donor}` : ''}`;
  });
  pushSection('SAME WORK as another pin (title+year+hash, or image-identical under differing titles)', buckets['pinterest-same'], (i, d) => `${i.file} = ${(d as { of: string }).of}`);
  pushSection('NEW works (would insert)', buckets.new, (i) => `${i.file} title="${finalTitle.get(i.src)}" year=${i.year ?? 'null'} (${i.yearSource ?? 'no-year'}) titleSource=${i.titleSource} attributed=${i.attributed} pins=${i.pins} boards=${i.boards.join(',')}`);
  pushSection('HELD ambiguous-title', buckets['ambiguous-title'], (i, d) => {
    const dd = d as { cands: { id: number; file: string }[]; conflictDist?: number };
    const candTxt = dd.cands.map((c) => (c.id >= 0 ? `${c.id}:${c.file}` : c.file)).join(',');
    return `${i.file} pin="${i.title}" cands=${candTxt}${dd.conflictDist != null ? ` VISUAL-CONFLICT dist=${dd.conflictDist}` : ''}`;
  });
  pushSection('HELD ambiguous-hash', buckets['ambiguous-hash'], (i, d) => {
    const dd = d as { cands: { file: string; dist: number }[] };
    return `${i.file} cands=${dd.cands.map((c) => `${c.file}@${c.dist}`).join(',')}`;
  });
  pushSection(`HELD near (dist<=${NEAR_MAX})`, buckets.near, (i, d) => {
    const dd = d as { best: { id: number; dist: number }; second: { id: number; dist: number } | null };
    const t = (id: number) => trackedById.get(id)?.title ?? '?';
    return `${i.file} best=${dd.best.dist} to tracked ${dd.best.id} "${t(dd.best.id)}"${dd.second ? ` second=${dd.second.dist} to ${dd.second.id}` : ''}`;
  });
  pushSection('HELD dup-target (tracked row already claimed)', buckets['dup-target'], (i, d) => {
    const dd = d as { wikiId: number; dist: number };
    return `${i.file} -> tracked ${dd.wikiId} "${trackedById.get(dd.wikiId)?.title}" claimed by ${claimedByOf(i.src, dd.wikiId)} dist=${dd.dist < 0 ? 'n/a' : dd.dist}`;
  });
  pushSection('HELD nohash (download failed, no insert without proof)', buckets['hold-nohash'], (i) => `${i.file}`);
  pushSection('HELD no-attribution (board-only pin, never inserted blind)', buckets['no-attribution'], (i) => `${i.file} pins=${i.pins} boards=${i.boards.join(',')}`);
  pushSection('VERDICT DROPS (adjudicated non-Schikaneder images — never applied)', buckets['verdict-drop'], (i, d) => `${i.file} — ${(d as { why: string }).why}`);
  if (trackedOnly.length) {
    lines.push(`## tracked works with no Pinterest counterpart (${trackedOnly.length})`);
    for (const t of trackedOnly) lines.push(`- ${t.id} "${t.title}" ${t.year ?? ''}`);
    lines.push('');
  }

  // ---------------- apply ----------------
  const linked: string[] = [];
  const inserted: string[] = [];
  const samelinks: string[] = [];
  const doneRepairs: string[] = [];
  if (apply) {
    for (const r of repairs) {
      await db.update(artworks).set({ title: r.to, updatedAt: new Date() }).where(eq(artworks.id, r.id));
      doneRepairs.push(`artwork ${r.id} "${r.from}" -> "${r.to}"`);
      console.log(`TITLE-REPAIR artwork ${r.id}: "${r.from}" -> "${r.to}"`);
    }
    // pass 1: insert new works (with their final, possibly identifier-suffixed titles)
    for (const item of plannedInserts) {
      const title = finalTitle.get(item.src)!;
      const externalId = extId(item.src);
      const [row] = await db
        .insert(artworks)
        .values({
          artistId: artistRow.id,
          provider: PROVIDER,
          externalId,
          title,
          year: item.year,
          imageUrl: item.url,
          paintingUrl: item.page,
          metadata: {
            pinterestPath: item.src,
            sourcePin: item.sourcePin,
            pins: item.pins,
            boards: item.boards,
            repinMax: item.repinMax,
            yearSource: item.yearSource,
            titleSource: item.titleSource,
            attributed: item.attributed,
          },
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({ target: [artworks.provider, artworks.externalId], set: { updatedAt: new Date() } })
        .returning({ id: artworks.id });
      await upsertArtworkSource({
        artworkId: row.id,
        provider: PROVIDER,
        externalId,
        sourceUrl: item.page,
        imageUrl: item.url,
        title,
        confidence: 100,
        isPrimary: true,
        lastSyncedAt: new Date(),
      });
      inserted.push(`artwork ${row.id} "${title}" <- ${item.file}`);
      console.log(`INSERT artwork ${row.id} "${title}" <- ${item.file}`);
    }
    // pass 2: links onto existing tracked rows
    for (const item of items) {
      if (already.has(extId(item.src))) continue;
      const d = decisions.get(item.src);
      if (!d || (d.type !== 'title' && d.type !== 'hash')) continue;
      await upsertArtworkSource({
        artworkId: d.wikiId,
        provider: PROVIDER,
        externalId: extId(item.src),
        sourceUrl: item.page,
        imageUrl: item.url,
        title: item.title || item.file.replace(/\.[A-Za-z]+$/, ''),
        confidence: d.confidence,
        isPrimary: false,
        lastSyncedAt: new Date(),
      });
      const distTxt = d.type === 'hash' ? ` dist=${d.dist < 0 ? 'img-verdict' : d.dist}` : '';
      linked.push(`${item.file} -> tracked ${d.wikiId} (${d.type}${distTxt})`);
      console.log(`LINK ${item.file} -> tracked ${d.wikiId} (${d.type}${distTxt})`);
    }
    // pass 3: same-work twins link onto their primary (inserted in pass 1)
    for (const item of items) {
      if (already.has(extId(item.src))) continue;
      const d = decisions.get(item.src);
      if (!d || d.type !== 'pinterest-same') continue;
      const target = await db
        .select({ id: artworks.id })
        .from(artworks)
        .where(and(eq(artworks.provider, PROVIDER), eq(artworks.externalId, extId(d.of))));
      if (target.length !== 1) {
        throw new Error(`PINTEREST-SAME target ${d.of} resolved to ${target.length} artwork rows — no fallback (primary must be inserted in pass 1)`);
      }
      await upsertArtworkSource({
        artworkId: target[0].id,
        provider: PROVIDER,
        externalId: extId(item.src),
        sourceUrl: item.page,
        imageUrl: item.url,
        title: item.title || item.file.replace(/\.[A-Za-z]+$/, ''),
        confidence: 90,
        isPrimary: false,
        lastSyncedAt: new Date(),
      });
      samelinks.push(`${item.file} -> artwork ${target[0].id} (same work as ${d.of})`);
      console.log(`LINK ${item.file} -> artwork ${target[0].id} (same work as ${d.of})`);
    }

    // ---------------- post-write asserts (loud) ----------------
    const fails: string[] = [];
    const after = (await db.select({ id: artworks.id, title: artworks.title }).from(artworks).where(eq(artworks.artistId, artistRow.id))) as {
      id: number;
      title: string;
    }[];
    const keys = after.map((r) => normTitle(r.title));
    const dupAfter = [...new Set(keys.filter((k, i) => keys.indexOf(k) !== i))];
    if (dupAfter.length > 0) fails.push(`post-write title uniqueness FAILED: ${dupAfter.length} dup key(s) ${dupAfter.join(' | ')}`);
    if (inserted.length !== plannedInserts.length) fails.push(`inserted ${inserted.length} != planned ${plannedInserts.length}`);
    const plannedLinks = items.filter((i) => {
      if (already.has(extId(i.src))) return false;
      const d = decisions.get(i.src);
      return d?.type === 'title' || d?.type === 'hash';
    }).length;
    const plannedSame = items.filter((i) => !already.has(extId(i.src)) && decisions.get(i.src)?.type === 'pinterest-same').length;
    if (linked.length !== plannedLinks) fails.push(`linked ${linked.length} != planned ${plannedLinks}`);
    if (samelinks.length !== plannedSame) fails.push(`pinterest-same ${samelinks.length} != planned ${plannedSame}`);
    const pinterestRows = (
      await db
        .select({ id: artworks.id })
        .from(artworks)
        .where(and(eq(artworks.artistId, artistRow.id), eq(artworks.provider, PROVIDER)))
    ).length;
    const primaryRes = await db.execute(
      sql`SELECT count(*)::int AS n FROM artwork_external_ids e JOIN artworks a ON a.id = e.artwork_id WHERE e.provider = 'pinterest' AND e.is_primary = true AND a.provider = 'pinterest' AND a.artist_id = ${artistRow.id}`,
    );
    const primaryRows = (Array.isArray(primaryRes) ? primaryRes : ((primaryRes as unknown as { rows?: unknown[] }).rows ?? [])) as { n: number }[];
    if (primaryRows[0]?.n !== pinterestRows) fails.push(`primary pinterest source rows ${primaryRows[0]?.n} != pinterest artworks ${pinterestRows}`);
    if (fails.length > 0) {
      console.error('!! POST-WRITE ASSERT FAILED:');
      for (const f of fails) console.error(`   - ${f}`);
      process.exit(1);
    }
  }

  lines.push('## actions' + (apply ? '' : ' (DRY RUN — nothing written)'));
  lines.push(`- title repairs: ${apply ? doneRepairs.length : repairs.length}${apply ? '' : ` (would repair ${repairs.length})`}`);
  lines.push(`- linked: ${linked.length}${apply ? '' : ` (would link; matched set = ${buckets.title.length + buckets.hash.length})`}`);
  lines.push(`- same-work links: ${samelinks.length}${apply ? '' : ` (would link; ${buckets['pinterest-same'].length})`}`);
  lines.push(`- inserted: ${inserted.length}${apply ? '' : ` (would insert; ${buckets.new.length} new)`}`);
  lines.push(`- held: ${heldCount}${heldCount > 0 ? ' (listed above — re-run after adjudication)' : ''}`);
  lines.push(`- verdict drops (adjudicated non-Schikaneder images, never applied): ${buckets['verdict-drop'].length}`);
  if (apply) {
    for (const l of doneRepairs) lines.push(`  - REPAIR ${l}`);
    for (const l of linked) lines.push(`  - LINK ${l}`);
    for (const l of samelinks) lines.push(`  - LINK ${l}`);
    for (const i of inserted) lines.push(`  - INSERT ${i}`);
  }
  lines.push('');
  writeFileSync(REPORT, lines.join('\n'), 'utf8');

  console.log(`REPORT -> ${REPORT}`);
  if (titleMatchDists.length > 0) {
    const sorted = [...titleMatchDists].sort((a, b) => a - b);
    console.log(`TITLE-DIST n=${sorted.length} min=${sorted[0]} max=${sorted[sorted.length - 1]} values=${sorted.join(',')}`);
  }
  console.log(
    `MODE=${apply ? 'APPLY' : 'DRY-RUN'} title=${buckets.title.length} hash=${buckets.hash.length} same=${buckets['pinterest-same'].length} new=${buckets.new.length} drop=${buckets['verdict-drop'].length} HELD=${heldCount} tracked-only=${trackedOnly.length} linked=${linked.length} inserted=${inserted.length} repaired=${apply ? doneRepairs.length : repairs.length}`,
  );
  for (const t of trackedOnly) console.log(`TRACKED-ONLY ${t.id} "${t.title}" ${t.year ?? ''}`);
  for (const i of buckets.new) console.log(`PLAN-INSERT "${finalTitle.get(i.src)}" <- ${i.file}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'scrape') await scrape();
  else if (mode === 'urls') await urls();
  else if (mode === 'hash') await hash();
  else if (mode === 'import') await runImport(process.argv.includes('--apply'));
  else throw new Error(`unknown mode "${mode}" — expected scrape|urls|hash|import [--apply]`);
}

main().catch((e) => {
  console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
