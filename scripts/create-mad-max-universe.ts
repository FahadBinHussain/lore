// Universe creator: Mad Max (AGENTS "Universe creation workflow").
// Research: research/mad-max-franchise.md (gitignored — never commit it).
// 55 bound items across 7 providers — verify-then-insert: every item is re-verified
// against its provider API in this run (title assertion), then inserted through
// ensureCanonicalMediaItem (tmdb/igdb/openlibrary/comicvine/bgg/musicbrainz).
// No manual phase: the only bindable provider gap (*Outlander*, IGDB auth 401 during
// the research run) closed on retry → igdb 10353. Remaining gaps stay loud + report-only
// (podcasts ListenNotes 401, pinball IPDB 403, console stores TCP-blocked, 1979 TV cut
// = an edition of tmdb 9659, themeparks proven absent by the research crawl).
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, mediaItems, users } from '../src/db/schema';
import { ensureCanonicalMediaItem } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';

type MediaType = 'movie' | 'tv' | 'game' | 'book' | 'comic' | 'boardgame' | 'soundtrack';

type ResearchItem = {
  mediaType: MediaType;
  title: string;
  source: string;
  externalId: string;
  releaseDate: string | null;
  author?: string;
  publisher?: string | null;
  notes?: string;
  yearOnly?: boolean; // provider stores a bare year (or YYYY-01-01) -> Dec 31 normalization
};

const GAME_IDS = [3034, 2552, 10353];

// Research inventory (research/mad-max-franchise.md §1-§8). Order = tie-break within the same date.
const ITEMS: ResearchItem[] = [
  // ---- films (5, TMDB) ----
  { mediaType: 'movie', title: 'Mad Max', source: 'tmdb', externalId: '9659', releaseDate: '1979-04-12', notes: 'AU theatrical 1979-04-12 (TMDB release_date); US theatrical 1980-03-21; 88-min violence-cut TV version has no TMDB record — edition of this film (research §12)' },
  { mediaType: 'movie', title: 'Mad Max 2', source: 'tmdb', externalId: '8810', releaseDate: '1981-12-24', notes: 'a.k.a. The Road Warrior (US title)' },
  { mediaType: 'movie', title: 'Mad Max Beyond Thunderdome', source: 'tmdb', externalId: '9355', releaseDate: '1985-06-29', notes: 'hold: TMDB 1985-06-29 vs Wikipedia 1985-07-10 (US) — TMDB kept (binding provider)' },
  { mediaType: 'movie', title: 'Mad Max: Fury Road', source: 'tmdb', externalId: '76341', releaseDate: '2015-05-13', notes: 'hold: TMDB 2015-05-13 vs Wikipedia 2015-05-15 — TMDB kept; Black & Chrome Edition = alternate cut, not an item (research §9.2)' },
  { mediaType: 'movie', title: 'Furiosa: A Mad Max Saga', source: 'tmdb', externalId: '786892', releaseDate: '2024-05-22', notes: 'hold: TMDB 2024-05-22 vs Wikipedia 2024-05-24 — TMDB kept; Black & Chrome Edition = alternate cut, not an item (research §9.2)' },

  // ---- documentaries / making-of (12, TMDB) ----
  { mediaType: 'movie', title: "The Making of 'Mad Max Beyond Thunderdome'", source: 'tmdb', externalId: '1295430', releaseDate: '1985-06-25', notes: 'contemporary making-of' },
  { mediaType: 'movie', title: 'Spécial Mad Max', source: 'tmdb', externalId: '1464628', releaseDate: '1985-09-14', notes: 'French TV special' },
  { mediaType: 'movie', title: 'Mad Max: Film Phenomenon', source: 'tmdb', externalId: '1756145', releaseDate: '2002-12-31', yearOnly: true, notes: 'year-only date normalized to Dec 31 per convention' },
  { mediaType: 'movie', title: 'The Madness of Max', source: 'tmdb', externalId: '358804', releaseDate: '2015-08-01', notes: 'hold: TMDB 2015-08-01 vs some press 2014 — TMDB kept (binding provider)' },
  { mediaType: 'movie', title: "Road War: The Making of 'The Road Warrior'", source: 'tmdb', externalId: '441695', releaseDate: '2016-12-06', notes: 'retrospective on Mad Max 2' },
  { mediaType: 'movie', title: 'Going Mad: The Battle of Fury Road', source: 'tmdb', externalId: '704725', releaseDate: '2017-08-01' },
  { mediaType: 'movie', title: 'Mad Max Exposed', source: 'tmdb', externalId: '1150126', releaseDate: '2022-06-01' },
  { mediaType: 'movie', title: 'Highway to Valhalla: In Pursuit of Furiosa', source: 'tmdb', externalId: '1327632', releaseDate: '2024-08-13', notes: 'behind-the-scenes on Furiosa' },
  { mediaType: 'movie', title: "It's a Mad Max World", source: 'tmdb', externalId: '1504199', releaseDate: '2025-06-22' },
  { mediaType: 'movie', title: 'Short Cuts : Mad Max de George Miller', source: 'tmdb', externalId: '1507743', releaseDate: '2025-06-29', notes: 'French documentary' },
  { mediaType: 'movie', title: 'Mad Max and the Genius of George Miller', source: 'tmdb', externalId: '1545263', releaseDate: '2025-10-21' },
  { mediaType: 'movie', title: 'Mad Max Fury on four wheels', source: 'tmdb', externalId: '1754734', releaseDate: null, notes: 'no release_date in TMDB — undated, sorts last' },

  // ---- tv (1, TMDB) ----
  { mediaType: 'tv', title: 'Mad Max, univers brûlant', source: 'tmdb', externalId: '231856', releaseDate: '2016-05-10', notes: 'French documentary series (Ended) — the only franchise TV record in TMDB' },

  // ---- games (3, IGDB) ----
  { mediaType: 'game', title: 'Mad Max (1990)', source: 'igdb', externalId: '3034', releaseDate: '1990-07-01', notes: 'title suffixed (1990) for uniqueness — IGDB name is "Mad Max" (same as the 2015 game); NES, Grey Matter/Mindscape; hold: IGDB day 1990-07-01 vs Wikipedia year-only 1990 — IGDB kept' },
  { mediaType: 'game', title: 'Mad Max (2015)', source: 'igdb', externalId: '2552', releaseDate: '2015-09-01', notes: 'title suffixed (2015) for uniqueness — IGDB name is "Mad Max"; Avalanche/WB; Steam appid 234140; cancelled DLC not an item (research §4.1); PS3/360 versions cancelled (research §10)' },
  { mediaType: 'game', title: 'Outlander', source: 'igdb', externalId: '10353', releaseDate: '1992-12-31', yearOnly: true, notes: 'IGDB year-only -> Dec 31; Wikipedia dates Genesis/SNES Mar-Apr 1993; originally developed as The Road Warrior (Mad Max 2) tie-in by Mindscape, retitled when the licence was lost — closed the research provider gap (research §12)' },

  // ---- books (19, Open Library) ----
  { mediaType: 'book', title: 'Mad Max (1985)', source: 'openlibrary', externalId: 'OL10590854M', releaseDate: '1985-12-31', yearOnly: true, notes: 'title suffixed (1985) for uniqueness — QB Books novelisation of the 1979 film; orphan edition, no parent OL...W work (research §13.5); year-only precision' },
  { mediaType: 'book', title: 'Mad Max 2 (1981)', source: 'openlibrary', externalId: 'OL8393986W', releaseDate: '1981-12-31', yearOnly: true, notes: 'title suffixed (1981) for uniqueness — OL title "MAD MAX 2"; QB Books novelisation by Terry Hayes; year-only precision' },
  { mediaType: 'book', title: 'Mad Max 2 (1983)', source: 'openlibrary', externalId: 'OL35307648W', releaseDate: '1983-12-31', yearOnly: true, notes: 'title suffixed (1983) for uniqueness — French-language edition of the same novelisation; OL publisher metadata unusable ("Paris") (research §13.6); year-only precision' },
  { mediaType: 'book', title: 'Mad Max Beyond Thunderdome (Joan D. Vinge)', source: 'openlibrary', externalId: 'OL8134215W', releaseDate: '1985-12-31', yearOnly: true, notes: 'title suffixed with author for uniqueness (collides with the Ann Matthews junior tie-in); Joan D. Vinge novelisation; year-only precision' },
  { mediaType: 'book', title: 'Mad Max Beyond Thunderdome (Ann Matthews)', source: 'openlibrary', externalId: 'OL3017373W', releaseDate: '1985-12-31', yearOnly: true, notes: 'title suffixed with author for uniqueness (collides with the Joan D. Vinge novelisation); Wanderer Books junior/abridged tie-in (Wikipedia credits only Vinge); year-only precision' },
  { mediaType: 'book', title: 'The "Mad Max" Movies', source: 'openlibrary', externalId: 'OL2294090W', releaseDate: '2003-12-31', yearOnly: true, notes: 'Adrian Martin; year-only precision' },
  { mediaType: 'book', title: 'Die Mad Max Trilogie', source: 'openlibrary', externalId: 'OL38573149W', releaseDate: '1998-12-31', yearOnly: true, notes: 'R. Weber, German study guide; year-only precision' },
  { mediaType: 'book', title: 'Europe Mad Max demain', source: 'openlibrary', externalId: 'OL40631689W', releaseDate: '2013-12-31', yearOnly: true, notes: 'Bernard Wicht, French; year-only precision' },
  { mediaType: 'book', title: 'Mad Max trilogy', source: 'openlibrary', externalId: 'OL22922073W', releaseDate: '2015-12-31', yearOnly: true, notes: 'EUS, Italian trilogy guide; year-only precision' },
  { mediaType: 'book', title: 'The art of Mad Max', source: 'openlibrary', externalId: 'OL22304314W', releaseDate: '2015-12-31', yearOnly: true, notes: 'Titan, Abbie Bernstein art book; year-only precision' },
  { mediaType: 'book', title: 'Meikingu obu Maddo Makkusu', source: 'openlibrary', externalId: 'OL20010942W', releaseDate: '2015-12-31', yearOnly: true, notes: 'Bernstein, Japanese making-of; year-only precision' },
  { mediaType: 'book', title: 'Trauma and Disability in Mad Max', source: 'openlibrary', externalId: 'OL20924085W', releaseDate: '2019-08-27', notes: 'Palgrave Pivot academic study' },
  { mediaType: 'book', title: 'Mad Max (2019)', source: 'openlibrary', externalId: 'OL21190843W', releaseDate: '2019-12-31', yearOnly: true, notes: 'title suffixed (2019) for uniqueness — Martyn Conterio, Auteur Publishing criticism; year-only precision' },
  { mediaType: 'book', title: 'Furious Feminisms : Alternate Routes on Mad Max', source: 'openlibrary', externalId: 'OL22139300W', releaseDate: '2020-12-31', yearOnly: true, notes: 'Univ. of Minnesota Press anthology; year-only precision' },
  { mediaType: 'book', title: 'Mad Max Effect', source: 'openlibrary', externalId: 'OL25761318W', releaseDate: '2021-12-31', yearOnly: true, notes: 'hold: OL first_publish_year 2021 vs edition publish 2022 — work year kept; Bloomsbury Academic; year-only precision' },
  { mediaType: 'book', title: 'Blood, Sweat and Chrome : The Wild and True Story of Mad Max', source: 'openlibrary', externalId: 'OL26524129W', releaseDate: '2022-12-31', yearOnly: true, notes: 'Kyle Buchanan making-of; year-only precision' },
  { mediaType: 'book', title: 'Mad Max and Philosophy', source: 'openlibrary', externalId: 'OL35718833W', releaseDate: '2023-12-31', yearOnly: true, notes: 'Wiley anthology; year-only precision' },
  { mediaType: 'book', title: 'Legend of Mad Max', source: 'openlibrary', externalId: 'OL37761726W', releaseDate: '2024-12-31', yearOnly: true, notes: 'Ian Nathan; year-only precision' },
  { mediaType: 'book', title: 'Mad Max : Fury Road — Movies Minute by Minute', source: 'openlibrary', externalId: 'OL42410443W', releaseDate: '2025-12-31', yearOnly: true, notes: 'Bloomsbury Academic, Alix Olson; year-only precision' },

  // ---- comics (5, Comic Vine volumes — 2015 Vertigo run; store dates from issue detail) ----
  { mediaType: 'comic', title: 'Mad Max: Fury Road Inspired Artists - Deluxe Edition', source: 'comicvine', externalId: 'volume-81823', releaseDate: '2015-05-06', publisher: 'DC Comics', notes: 'art-book one-shot; store date from issue 4000-487819' },
  { mediaType: 'comic', title: 'Mad Max: Fury Road: Nux & Immortan Joe', source: 'comicvine', externalId: 'volume-82069', releaseDate: '2015-05-20', publisher: 'DC Comics', notes: 'issue 1 of the 2015 four-issue run; store date from issue 4000-489306' },
  { mediaType: 'comic', title: 'Mad Max: Fury Road: Furiosa', source: 'comicvine', externalId: 'volume-82694', releaseDate: '2015-06-17', publisher: 'DC Comics', notes: 'issue 2 of the run; store date from issue 4000-492198; ES Norma reprint volume-163794 merged here (research §6.2)' },
  { mediaType: 'comic', title: 'Mad Max: Fury Road: Max', source: 'comicvine', externalId: 'volume-83143', releaseDate: '2015-07-08', publisher: 'DC Comics', notes: 'issues 3-4 of the run; store date from issue 4000-494307' },
  { mediaType: 'comic', title: 'Mad Max: Fury Road', source: 'comicvine', externalId: 'volume-84284', releaseDate: '2015-09-02', publisher: 'DC Comics', notes: 'collected edition of the run; hold: CV store 2015-09-02 vs Wikipedia 2015-08-26 — CV kept; DE Panini edition volume-131089 merged here (research §6.2)' },

  // ---- board game (1, BGG) ----
  { mediaType: 'boardgame', title: 'Mad Max', source: 'bgg', externalId: '230602', releaseDate: '2017-12-31', yearOnly: true, notes: 'BGG year-only -> Dec 31; card game for 2-4 players' },

  // ---- soundtracks (9, MusicBrainz release-groups — MB dates are the bound values) ----
  { mediaType: 'soundtrack', title: 'Mad Max', source: 'musicbrainz', externalId: '3c2fde6f-511d-3ab6-a528-1a8ead3865b1', releaseDate: '1980-12-31', yearOnly: true, author: 'Brian May', notes: 'Varèse Sarabande album; MB year-only -> Dec 31 (Wikipedia 1980-04-30)' },
  { mediaType: 'soundtrack', title: 'Mad Max 2', source: 'musicbrainz', externalId: 'ed117aa4-adad-4170-81c7-c4bf5dd438a8', releaseDate: '1982-12-31', yearOnly: true, author: 'Brian May', notes: 'MB year-only -> Dec 31 (Wikipedia 1982-01-11)' },
  { mediaType: 'soundtrack', title: 'Mad Max: Beyond Thunderdome: Original Motion Picture Soundtrack', source: 'musicbrainz', externalId: 'f8c65993-2622-38aa-b8bd-23fef85e9823', releaseDate: '1985-12-31', yearOnly: true, author: 'Various Artists', notes: 'Capitol album; MB year-only -> Dec 31 (Wikipedia Aug 1985)' },
  { mediaType: 'soundtrack', title: 'We Don’t Need Another Hero (Thunderdome)', source: 'musicbrainz', externalId: 'a9449625-be18-3c98-a192-9d3c3520d92d', releaseDate: '1985-07-08', author: 'Tina Turner', notes: "the film's end-title single" },
  { mediaType: 'soundtrack', title: 'Mad Max: Beyond Thunderdome', source: 'musicbrainz', externalId: '6b13b264-5e37-41d0-a65e-476e8052e9d6', releaseDate: '2010-05-25', author: 'Maurice Jarre', notes: 'score reissue' },
  { mediaType: 'soundtrack', title: 'Mad Max: Fury Road: Original Motion Picture Soundtrack', source: 'musicbrainz', externalId: '171a7120-6a84-41b7-a037-fcc84bf9a5f3', releaseDate: '2015-05-12', author: 'Tom Holkenborg aka Junkie XL' },
  { mediaType: 'soundtrack', title: 'Mad Max Univers Brûlant [Original Soundtrack]', source: 'musicbrainz', externalId: 'e2c8352b-754a-4a59-9c2e-c3a092cf4ba9', releaseDate: '2016-05-16', author: '2080', notes: 'tie-in to the doc series tmdb 231856' },
  { mediaType: 'soundtrack', title: 'Mad Max : Univers Brûlant OST', source: 'musicbrainz', externalId: '728ebafb-f755-4ca6-a8d7-ad480e4555f7', releaseDate: '2016-05-20', author: 'Ivort', notes: 'second MB release-group for the same doc series (different artist — not a dup of e2c8352b)' },
  { mediaType: 'soundtrack', title: 'Furiosa: A Mad Max Saga (Original Motion Picture Soundtrack)', source: 'musicbrainz', externalId: 'dbea6d82-644a-4a75-a093-04818663e34e', releaseDate: '2024-05-17', author: 'Tom Holkenborg' },
];

// ---------------------------------------------------------------- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type NamedRef = { name?: string };
type IgdbGame = {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number;
  cover?: { url?: string };
  rating?: number;
  genres?: NamedRef[];
  platforms?: NamedRef[];
  involved_companies?: Array<{ developer?: boolean; publisher?: boolean; company?: { name?: string } }>;
};
type TmdbMovie = {
  title?: string;
  release_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  genres?: Array<{ name?: string }>;
  vote_average?: number;
  runtime?: number | null;
  status?: string;
};
type TmdbTv = {
  name?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  networks?: Array<{ name?: string }>;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
};
type CvVolumeResponse = {
  error?: string;
  status_code?: number;
  results?: { name?: string; start_year?: number; publisher?: { name?: string }; image?: { original_url?: string } };
};
type MbReleaseGroup = { title?: string };
type BggThing = { name: string; yearpublished: number | null; image: string | null };
type OlRecord = { title?: string; first_publish_year?: number; description?: string | { value?: string } };

async function fetchJson(url: string, init?: RequestInit, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429 || resp.status >= 500) {
        if (attempt === retries) throw new Error(`HTTP ${resp.status} after ${retries} tries: ${url}`);
        await sleep(1500 * attempt);
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
      return await resp.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * attempt);
    }
  }
  throw new Error('unreachable');
}

async function fetchText(url: string, init?: RequestInit, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.ok) return await resp.text();
    if (attempt === retries) throw new Error(`HTTP ${resp.status}: ${url}`);
    await sleep(1200 * attempt);
  }
  throw new Error('unreachable');
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Title assertion: exact/containment after normalization, else compare cores left after
// stripping the franchise prefix (so two *different* Mad Max titles never pass each other).
// Disambiguated stored titles ("Mad Max (2015)") pass by containment against the provider's
// plain title — the callers log containment matches loudly.
function titlesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sa = na.replace(/^madmax/, '');
  const sb = nb.replace(/^madmax/, '');
  if (!sa || !sb) return false;
  return sa.includes(sb) || sb.includes(sa);
}

function unixToIso(unix?: number): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().split('T')[0];
}

function tmdbPoster(path?: string | null): string | null {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}
function tmdbBackdrop(path?: string | null): string | null {
  return path ? `https://image.tmdb.org/t/p/w1280${path}` : null;
}

function mapTmdbStatus(status?: string): string | null {
  switch (status) {
    case 'Released':
      return 'released';
    case 'Upcoming':
      return 'upcoming';
    case 'Canceled':
    case 'Cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

// yearOnly rows: a bare year arrives as YYYY-01-01 from some providers -> Dec 31 (never Jan 1)
function normalizeYearOnly(date: string | null, flag: boolean | undefined): string | null {
  if (!date || !flag) return date;
  const m = /^(\d{4})-01-01$/.exec(date);
  return m ? `${m[1]}-12-31` : date;
}

type VerifiedItem = ResearchItem & {
  posterPath?: string | null;
  backdropPath?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  networks?: string[];
  runtime?: number | null;
  developer?: string | null;
  rating?: number | null;
  seasons?: number | null;
  totalEpisodes?: number | null;
  status?: string | null;
  verifiedDate?: string | null;
  providerTitle?: string;
  alreadyInDb?: boolean;
};

const failures: string[] = [];

// ---------------------------------------------------------------- verifiers

async function verifyGames(): Promise<Map<string, IgdbGame>> {
  const clientId = process.env.IGDB_CLIENT_ID!;
  const clientSecret = process.env.IGDB_CLIENT_SECRET!;
  const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
  });
  if (!tokenResp.ok) throw new Error(`IGDB token HTTP ${tokenResp.status}`);
  const { access_token } = (await tokenResp.json()) as { access_token: string };

  const body = `fields id, name, summary, first_release_date, cover.url, rating, genres.name, platforms.name, involved_companies.company.name, involved_companies.developer, involved_companies.publisher; where id = (${GAME_IDS.join(',')}); limit 20;`;
  const rows = (await fetchJson('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${access_token}`, 'Content-Type': 'text/plain' },
    body,
  })) as IgdbGame[];

  const byId = new Map<string, IgdbGame>();
  for (const row of rows) byId.set(String(row.id), row);
  return byId;
}

async function verifyTmdbMovie(id: string): Promise<TmdbMovie> {
  return (await fetchJson(`https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}`)) as TmdbMovie;
}

async function verifyTmdbTv(id: string): Promise<TmdbTv> {
  return (await fetchJson(`https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}`)) as TmdbTv;
}

async function verifyComicVolume(volumeId: string): Promise<CvVolumeResponse> {
  const url = `https://comicvine.gamespot.com/api/volume/4050-${volumeId}/?api_key=${process.env.COMICVINE_API_KEY}&format=json&field_list=name,start_year,publisher,image`;
  return (await fetchJson(url, {}, 4)) as CvVolumeResponse;
}

// MusicBrainz: rate limit ~1 req/s, TLS-level blocking on bursts, and throttled responses can
// come back 200 with an empty body — space lookups >= 3.1s apart and assert title is non-empty.
async function verifyMusicBrainzReleaseGroup(rgId: string): Promise<MbReleaseGroup> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await sleep(3100);
    try {
      const text = await fetchText(`https://musicbrainz.org/ws/2/release-group/${rgId}?fmt=json`, {
        headers: { 'User-Agent': 'LoreMediaTracker/1.0 (universe creator)' },
      });
      const parsed = JSON.parse(text) as MbReleaseGroup;
      if (!parsed.title) throw new Error('200 with empty title field (throttle?)');
      return parsed;
    } catch (err) {
      lastErr = err as Error;
      console.log(`  ~  MB retry for ${rgId.slice(0, 8)}… (${lastErr.message})`);
    }
  }
  throw new Error(`musicbrainz ${rgId} failed after 2 tries: ${lastErr?.message}`);
}

async function verifyBgg(ids: string[]): Promise<Map<string, BggThing>> {
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (compatible; LoreMediaTracker/1.0)' };
  if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;
  let xml = '';
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      xml = await fetchText(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}`, { headers });
      if (/<item /.test(xml)) break;
      lastErr = new Error('200 without <item> entries');
      await sleep(3500);
    } catch (err) {
      lastErr = err as Error;
      await sleep(3500); // BGG xmlapi2 flaky-401: retry ~3.5s apart
    }
  }
  if (!/<item /.test(xml)) throw new Error(`bgg thing lookup failed: ${lastErr?.message}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  const list = Array.isArray(items) ? items : [items];
  const byId = new Map<string, BggThing>();
  for (const item of list) {
    const id = String(item['@_id']);
    const names = item.name;
    const nameArr: Array<{ '@_type'?: string; '@_value'?: string }> = Array.isArray(names) ? names : [names];
    const primary = nameArr.find((n) => n['@_type'] === 'primary') ?? nameArr[0];
    byId.set(id, {
      name: primary?.['@_value'] ?? '',
      yearpublished: item.yearpublished?.['@_value'] ? Number(item.yearpublished['@_value']) : null,
      image: typeof item.image === 'string' ? item.image : null,
    });
  }
  return byId;
}

async function fetchOlRecord(olid: string): Promise<OlRecord> {
  const isEdition = /^OL\d+M$/.test(olid);
  return (await fetchJson(`https://openlibrary.org/${isEdition ? 'books' : 'works'}/${olid}.json`)) as OlRecord;
}

async function checkListenNotesPodcasts(): Promise<string[]> {
  const key = process.env.LISTEN_NOTES_API_KEY || process.env.LISTENNOTES_API_KEY;
  if (!key) return ['LISTEN_NOTES_API_KEY missing — podcast check skipped (source gap)'];
  try {
    const data = await fetchJson('https://listen-api.listennotes.com/api/v2/search?q=mad%20max&type=podcast', {
      headers: { 'X-ListenAPI-Key': key },
    });
    const results = (data.results ?? []) as Array<{ id: string; title: string; publisher: string }>;
    if (results.length === 0) return ['ListenNotes OK: 0 podcast results for "mad max"'];
    return results.slice(0, 5).map((r) => `candidate: "${r.title}" (${r.publisher}) id=${r.id}`);
  } catch (err) {
    return [`ListenNotes check failed: ${(err as Error).message} (research saw HTTP 401 — source gap, absence unproven)`];
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const mode = (process.argv[2] || 'dry').trim();
  if (mode === 'manual-dry' || mode === 'manual-apply') {
    console.log('mad-max has no manual items — all researched items are bound (Outlander closed as igdb 10353; remaining gaps are report-only, see research §12).');
    return;
  }
  if (mode !== 'dry' && mode !== 'apply') {
    console.error(`unknown mode "${mode}" — use: dry | apply`);
    process.exit(2);
  }

  console.log(`Mad Max universe — mode=${mode} (items=${ITEMS.length})\n`);

  const verified: VerifiedItem[] = ITEMS.map((i) => ({ ...i }));

  // -- movies (17 TMDB detail fetches)
  console.log('[1/7] verifying TMDB movies...');
  for (const item of verified.filter((i) => i.mediaType === 'movie')) {
    const m = await verifyTmdbMovie(item.externalId);
    if (!m.title || !titlesMatch(item.title, m.title)) {
      failures.push(`tmdb ${item.externalId} title mismatch: research "${item.title}" vs TMDB "${m.title}"`);
      continue;
    }
    if (norm(item.title) !== norm(m.title)) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs TMDB "${m.title}"`);
    }
    item.providerTitle = m.title;
    item.verifiedDate = normalizeYearOnly(m.release_date || item.releaseDate || null, item.yearOnly);
    if (item.yearOnly && m.release_date && !m.release_date.endsWith('-01-01') && m.release_date !== item.releaseDate) {
      item.verifiedDate = m.release_date; // provider has real precision after all
    }
    item.posterPath = tmdbPoster(m.poster_path);
    item.backdropPath = tmdbBackdrop(m.backdrop_path);
    item.description = m.overview || null;
    item.genres = (m.genres ?? []).map((g) => g.name).filter((n): n is string => Boolean(n));
    item.runtime = m.runtime ?? null;
    item.rating = typeof m.vote_average === 'number' && m.vote_average > 0 ? Number(m.vote_average.toFixed(1)) : null;
    item.status = mapTmdbStatus(m.status);
    const researchDiffers = item.releaseDate && m.release_date && !item.yearOnly && m.release_date !== item.releaseDate;
    console.log(`  ok  tmdb-${item.externalId} "${m.title}" → ${item.verifiedDate ?? 'undated'}${researchDiffers ? `  ~ research said ${item.releaseDate}` : ''}`);
    await sleep(120);
  }

  // -- tv (1)
  console.log('\n[2/7] verifying TMDB tv...');
  for (const item of verified.filter((i) => i.mediaType === 'tv')) {
    const tv = await verifyTmdbTv(item.externalId);
    if (!tv.name || !titlesMatch(item.title, tv.name)) {
      failures.push(`tmdb tv ${item.externalId} title mismatch: research "${item.title}" vs TMDB "${tv.name}"`);
      continue;
    }
    item.providerTitle = tv.name;
    item.verifiedDate = tv.first_air_date || item.releaseDate || null;
    item.posterPath = tmdbPoster(tv.poster_path);
    item.backdropPath = tmdbBackdrop(tv.backdrop_path);
    item.description = tv.overview || null;
    item.networks = (tv.networks ?? []).map((n) => n.name).filter((n): n is string => Boolean(n));
    item.seasons = tv.number_of_seasons ?? null;
    item.totalEpisodes = tv.number_of_episodes ?? null;
    item.status = mapTmdbStatus(tv.status);
    console.log(`  ok  tmdb-${item.externalId} "${tv.name}" (${item.seasons} seasons, ${item.totalEpisodes} eps)`);
  }

  // -- games (single IGDB batch)
  console.log('\n[3/7] verifying IGDB games...');
  const games = await verifyGames();
  for (const item of verified.filter((i) => i.mediaType === 'game')) {
    const g = games.get(item.externalId);
    if (!g) {
      failures.push(`igdb ${item.externalId} "${item.title}" — id not returned by IGDB`);
      continue;
    }
    if (!titlesMatch(item.title, g.name)) {
      failures.push(`igdb ${item.externalId} title mismatch: research "${item.title}" vs IGDB "${g.name}"`);
      continue;
    }
    if (norm(item.title) !== norm(g.name)) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs IGDB "${g.name}"`);
    }
    item.providerTitle = g.name;
    item.verifiedDate = normalizeYearOnly(unixToIso(g.first_release_date) ?? item.releaseDate, item.yearOnly);
    item.description = g.summary || null;
    item.genres = (g.genres ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.platforms = (g.platforms ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.developer = g.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    item.publisher = item.publisher ?? g.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
    item.rating = typeof g.rating === 'number' ? Number((g.rating / 10).toFixed(1)) : null;
    item.posterPath = g.cover?.url
      ? (g.cover.url.startsWith('//') ? `https:${g.cover.url}` : g.cover.url).replace('thumb', 'cover_big')
      : null;
    item.status = 'released';
    if (!g.first_release_date && item.releaseDate) {
      item.notes = [item.notes, 'IGDB has no release date — research date used'].filter(Boolean).join('; ');
    }
    console.log(`  ok  igdb-${item.externalId} "${g.name}" → ${item.verifiedDate ?? 'undated'}`);
  }

  // -- comics (5 sequential CV volume calls)
  console.log('\n[4/7] verifying Comic Vine volumes...');
  for (const item of verified.filter((i) => i.mediaType === 'comic')) {
    const volId = item.externalId.replace(/^volume-/, '');
    const resp = await verifyComicVolume(volId);
    if (resp.error !== 'OK' || resp.status_code !== 1) {
      failures.push(`comicvine volume-${volId} API error: ${resp.error} (${resp.status_code})`);
      continue;
    }
    const vol = resp.results ?? {};
    const name: string = vol.name ?? '';
    if (!name || !titlesMatch(item.title, name)) {
      failures.push(`comicvine volume-${volId} title mismatch: research "${item.title}" vs CV "${name}"`);
      continue;
    }
    item.providerTitle = name;
    item.verifiedDate = item.releaseDate; // issue store_date (research detail-fetched) is the bound value
    item.posterPath = vol.image?.original_url ?? null;
    item.publisher = vol.publisher?.name ?? item.publisher;
    item.status = 'released';
    console.log(`  ok  volume-${volId} CV"${name}" → ${item.verifiedDate}`);
    await sleep(300);
  }

  // -- soundtracks (9 MusicBrainz release-group lookups, >=3.1s apart)
  console.log('\n[5/7] verifying MusicBrainz release-groups...');
  for (const item of verified.filter((i) => i.mediaType === 'soundtrack')) {
    const rg = await verifyMusicBrainzReleaseGroup(item.externalId);
    if (!titlesMatch(item.title, rg.title ?? '')) {
      failures.push(`musicbrainz ${item.externalId} title mismatch: research "${item.title}" vs MB "${rg.title}"`);
      continue;
    }
    if (norm(item.title) !== norm(rg.title ?? '')) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs MB "${rg.title}"`);
    }
    item.providerTitle = rg.title;
    item.verifiedDate = item.releaseDate; // MB date is the bound value (research decision)
    item.status = 'released';
    console.log(`  ok  ${item.externalId.slice(0, 8)}… "${rg.title}" → ${item.verifiedDate}`);
  }

  // -- board game (1)
  console.log('\n[6/7] verifying BGG board games...');
  const bggItems = verified.filter((i) => i.mediaType === 'boardgame');
  const bgg = await verifyBgg(bggItems.map((i) => i.externalId));
  for (const item of bggItems) {
    const b = bgg.get(item.externalId);
    if (!b) {
      failures.push(`bgg ${item.externalId} "${item.title}" — id not returned by BGG`);
      continue;
    }
    if (!titlesMatch(item.title, b.name)) {
      failures.push(`bgg ${item.externalId} title mismatch: research "${item.title}" vs BGG "${b.name}"`);
      continue;
    }
    item.providerTitle = b.name;
    item.posterPath = b.image;
    item.verifiedDate = b.yearpublished ? `${b.yearpublished}-12-31` : item.releaseDate; // BGG year-only -> Dec 31
    item.status = 'released';
    console.log(`  ok  bgg-${item.externalId} "${b.name}" (${b.yearpublished ?? 'undated'})`);
  }

  // -- books (19 Open Library detail fetches, titles asserted)
  console.log('\n[7/7] verifying Open Library books...');
  for (const item of verified.filter((i) => i.mediaType === 'book')) {
    const rec = await fetchOlRecord(item.externalId);
    if (!rec.title || !titlesMatch(item.title, rec.title)) {
      failures.push(`openlibrary ${item.externalId} title mismatch: research "${item.title}" vs OL "${rec.title}"`);
      continue;
    }
    if (norm(item.title) !== norm(rec.title)) {
      console.log(`  ~  title matched by containment: research "${item.title}" vs OL "${rec.title}"`);
    }
    item.providerTitle = rec.title;
    item.verifiedDate = item.releaseDate; // research date already Dec-31 where year-only
    const rawDesc = rec.description;
    item.description = typeof rawDesc === 'string' ? rawDesc : rawDesc?.value ?? null;
    item.status = 'released';
    console.log(`  ok  ${item.externalId.padEnd(12)} "${rec.title}" → ${item.verifiedDate}`);
    await sleep(200);
  }

  // -- source-gap checks (report only — loud, never silent)
  console.log('\n[8/8] source-gap checks (report only):');
  for (const line of await checkListenNotesPodcasts()) console.log(`  podcast: ${line}`);
  console.log('  themepark: proven absent — research crawled all 199 themeparks.wiki parks recursively, 0 Mad Max entities (research §11)');
  console.log('  pinball: IPDB 403 from this host — only an unlicensed homebrew exists (research §12); no tracker media type anyway');
  console.log('  console stores: Nintendo/Microsoft store APIs TCP-blocked from this host (research §12)');

  // -- failures: loud, and apply refuses to write
  if (failures.length > 0) {
    console.error(`\n!! ${failures.length} VERIFICATION FAILURE(S):`);
    for (const f of failures) console.error(`   - ${f}`);
    if (mode === 'apply') {
      console.error('\napply aborted — fix the mismatches above, nothing was written.');
      process.exit(1);
    }
  }

  // -- duplicate checks
  const existingColl = await db.query.collections.findFirst({ where: eq(collections.slug, 'mad-max') });
  if (existingColl) {
    console.error(`\n!! collection slug "mad-max" already exists (id ${existingColl.id}) — refusing to create a duplicate. Expand the existing universe instead.`);
    process.exit(1);
  }

  const already: number[] = [];
  for (const item of verified) {
    const row = await db.query.mediaItems.findFirst({
      where: (t, { and, eq }) => and(eq(t.source, item.source), eq(t.externalId, item.externalId)),
    });
    if (row) {
      item.alreadyInDb = true;
      already.push(row.id);
    }
  }

  // -- intra-universe title uniqueness (same (media_type, title) key the post-insert asserts)
  const keyList = verified.map((i) => `${i.mediaType}\u0000${i.title}`);
  const dupKeys = [...new Set(keyList.filter((k, i) => keyList.indexOf(k) !== i))];
  if (dupKeys.length > 0) {
    for (const k of dupKeys) failures.push(`duplicate (media_type, title) key in ITEMS: ${k.replace('\u0000', ' / ')}`);
    console.error('\n!! ITEMS self-check FAILED:');
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }

  // -- release order: date asc (nulls last), stable within same date
  const ordered = [...verified].sort((a, b) => {
    const da = a.verifiedDate ?? a.releaseDate;
    const dbb = b.verifiedDate ?? b.releaseDate;
    if (!da && !dbb) return 0;
    if (!da) return 1;
    if (!dbb) return -1;
    if (da === dbb) return 0;
    return da < dbb ? -1 : 1;
  });
  // stable tie-break: keep input order for equal dates (Array.sort is stable in V8)

  const counts: Record<string, number> = {};
  for (const i of ordered) counts[i.mediaType] = (counts[i.mediaType] ?? 0) + 1;

  console.log(`\n--- release order (${ordered.length} items) ---`);
  ordered.forEach((i, idx) => {
    const date = i.verifiedDate ?? i.releaseDate ?? '        --';
    const flag = i.alreadyInDb ? ' [exists]' : '';
    console.log(`${String(idx + 1).padStart(2)}. ${date}  ${i.mediaType.padEnd(11)} ${i.title}${flag}`);
  });
  console.log(`\nby type: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join('  ')}`);
  if (already.length > 0) console.log(`already in DB (will be linked, not recreated): ${already.join(', ')}`);

  if (mode === 'dry') {
    console.log('\ndry run — nothing written. Re-run with: apply');
    return;
  }

  // ---------------------------------------------------------------- apply
  console.log('\napplying...');

  const creator = (process.env.CREATOR_EMAIL ? await db.query.users.findFirst({ where: eq(users.email, process.env.CREATOR_EMAIL) }) : null) || await db.query.users.findFirst();
  if (!creator) {
    console.error('!! no user found in database — aborting');
    process.exit(1);
  }

  const cover = verified.find((i) => i.externalId === '76341')?.posterPath ?? null;
  const [newUniverse] = await db.insert(collections).values({
    name: 'Mad Max',
    slug: 'mad-max',
    description: 'Every official Mad Max media item — films, documentaries, games, books, comics, soundtracks, and the board game — in release order.',
    coverImage: cover,
    bannerImage: null,
    createdBy: creator.id,
    visibility: 'public',
    isFeatured: false,
    viewCount: 0,
    itemCount: ordered.length,
    followerCount: 0,
  }).returning();
  console.log(`collection created: id=${newUniverse.id} slug=${newUniverse.slug}`);

  let made = 0;
  let reused = 0;
  const memberships: Array<{ mediaItemId: number; releaseOrder: number; notes: string | null }> = [];

  for (let idx = 0; idx < ordered.length; idx++) {
    const item = ordered[idx];
    const result = await ensureCanonicalMediaItem({
      source: item.source,
      externalId: item.externalId,
      mediaType: item.mediaType,
      title: item.title,
      description: item.description ?? null,
      posterPath: item.posterPath ?? null,
      backdropPath: item.backdropPath ?? null,
      releaseDate: item.verifiedDate ?? item.releaseDate,
      rating: item.rating ?? null,
      genres: item.genres ?? null,
      runtime: item.runtime ?? null,
      developer: item.developer ?? null,
      publisher: item.publisher ?? null,
      author: item.author ?? null,
      platforms: item.platforms ?? null,
      networks: item.networks ?? null,
      seasons: item.seasons ?? null,
      totalEpisodes: item.totalEpisodes ?? null,
      status: item.status ?? null,
    });
    if (!result) {
      console.error(`!! ensureCanonicalMediaItem returned null for ${item.mediaType} ${item.externalId} "${item.title}" — aborting`);
      process.exit(1);
    }
    if (result.created) made++; else reused++;
    memberships.push({ mediaItemId: result.mediaItem.id, releaseOrder: idx + 1, notes: item.notes ?? null });
    console.log(`  [${idx + 1}/${ordered.length}] ${result.created ? 'created' : 'reused '} media_item ${result.mediaItem.id} — ${item.title}`);
  }

  await db.insert(collectionItems).values(
    memberships.map((m, idx) => ({
      collectionId: newUniverse.id,
      mediaItemId: m.mediaItemId,
      releaseOrder: m.releaseOrder,
      chronologicalOrder: null, // story placement unplaced per chrono rule (mixed film/doc/book set)
      groupName: null,
      isRequired: true,
      notes: m.notes,
    }))
  );

  // -- post-insert verification (loud)
  const finalRows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, newUniverse.id),
    with: { mediaItem: true },
  });
  const fails: string[] = [];
  if (finalRows.length !== ITEMS.length) fails.push(`expected ${ITEMS.length} memberships, got ${finalRows.length}`);
  const distinctIds = new Set(finalRows.map((r) => r.mediaItemId));
  if (distinctIds.size !== finalRows.length) fails.push(`duplicate memberships: ${finalRows.length - distinctIds.size} duplicates`);
  const orders = finalRows.map((r) => r.releaseOrder).sort((a, b) => a - b);
  if (orders.some((o, i) => o !== i + 1)) fails.push('release_order not contiguous 1..n');
  if (finalRows.some((r) => r.chronologicalOrder !== null)) fails.push('chronological_order must stay NULL (unplaced)');
  const typeTitleKeys = finalRows.map((r) => `${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`);
  const dupTitleKeys = [...new Set(typeTitleKeys.filter((k, i) => typeTitleKeys.indexOf(k) !== i))];
  if (dupTitleKeys.length > 0) fails.push(`duplicate titles within a media type: ${dupTitleKeys.map((k) => k.replace('\u0000', ' / ')).join(' | ')}`);
  const byType: Record<string, number> = {};
  for (const r of finalRows) byType[r.mediaItem.mediaType] = (byType[r.mediaItem.mediaType] ?? 0) + 1;
  for (const [type, expected] of Object.entries(counts)) {
    if (byType[type] !== expected) fails.push(`by-type count drift for ${type}: expected ${expected}, got ${byType[type] ?? 0}`);
  }
  for (const item of verified) {
    const ext = await db.query.mediaExternalIds.findFirst({
      where: and(
        eq(mediaExternalIds.provider, item.source),
        eq(mediaExternalIds.mediaType, item.mediaType),
        eq(mediaExternalIds.externalId, item.externalId)
      ),
    });
    if (!ext || !ext.isPrimary) fails.push(`no primary media_external_ids row for ${item.source}/${item.externalId}`);
  }
  const dupColl = await db.query.collections.findMany({ where: eq(collections.slug, 'mad-max') });
  if (dupColl.length !== 1) fails.push(`expected exactly 1 collection row, got ${dupColl.length}`);
  if (fails.length > 0) {
    console.error('\n!! post-insert verification FAILED:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }

  const typeLine = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`\nDONE: collection ${newUniverse.id} "Mad Max" — ${finalRows.length} memberships, ${distinctIds.size} distinct media_items (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/mad-max  (univrs.vercel.app)');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
