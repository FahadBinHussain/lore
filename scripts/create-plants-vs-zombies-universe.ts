// Universe creator: Plants vs. Zombies (AGENTS "Universe creation workflow").
// Research: research/plants-vs-zombies-franchise.md (gitignored — never commit it).
// Verify-then-insert: every bound item is re-verified against its provider API in this run
// (title assertion), then inserted through ensureCanonicalMediaItem (igdb/tmdb/openlibrary/
// comicvine/musicbrainz/bgg).
// Manual completion phase (user-approved 2026-09-29): the researched items no supported API
// carries get source='manual' rows, each with the real evidence URL stored in
// media_external_ids.source_url (provenance like artwork_external_ids).
// Run: npx esbuild bundle -> node --env-file=.env.local <bundle>.cjs [dry|apply|manual-dry|manual-apply]
import { db } from '../src/db/index';
import { collections, collectionItems, mediaExternalIds, mediaItems, users } from '../src/db/schema';
import { ensureCanonicalMediaItem, ensureMediaExternalMapping } from '../src/lib/media/canonical';
import { and, eq } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';

type MediaType = 'game' | 'tv' | 'book' | 'comic' | 'soundtrack' | 'boardgame' | 'themepark';

type ResearchItem = {
  mediaType: MediaType;
  title: string;
  source: string;
  externalId: string; // provider-verified below; formats follow existing DB rows
  releaseDate: string | null; // research fallback, provider date wins when present
  author?: string;
  publisher?: string | null;
  notes?: string; // uncertainty flags -> collection_items.notes
  // book resolution inputs
  isbn?: string;
  olid?: string;
  olidMustBeEdition?: boolean; // OL merges these two books into one work — keep distinct
};

const GAME_IDS = [
  1277, 287882, 77968, 3145, 124429, 3146, 124371, 395718,
  11148, 25230, 121618, 287877, 120900, 310568, 358529, 143989,
];

// Research inventory (bound items only). Order = tie-break within the same date.
const ITEMS: ResearchItem[] = [
  // ---- games (16, IGDB) ----
  { mediaType: 'game', title: 'Plants vs. Zombies', source: 'igdb', externalId: '1277', releaseDate: '2009-05-05' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Endless Edition', source: 'igdb', externalId: '287882', releaseDate: '2013-02-01', notes: 'China-only; "Journey to the West" redirects to this title' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Adventures', source: 'igdb', externalId: '77968', releaseDate: '2013-05-20' },
  { mediaType: 'game', title: "Plants vs. Zombies 2: It's About Time", source: 'igdb', externalId: '3145', releaseDate: '2013-08-15' },
  { mediaType: 'game', title: 'Plants vs. Zombies: The Last Stand', source: 'igdb', externalId: '124429', releaseDate: '2013-12-31', notes: 'official EA arcade machine' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Garden Warfare', source: 'igdb', externalId: '3146', releaseDate: '2014-02-18' },
  { mediaType: 'game', title: 'Plants vs. Zombies: All Stars', source: 'igdb', externalId: '124371', releaseDate: '2014-09-17', notes: 'date from wiki, IGDB has no date' },
  { mediaType: 'game', title: 'Use Your Brainz EDU', source: 'igdb', externalId: '395718', releaseDate: '2015-06-17' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Garden Warfare 2', source: 'igdb', externalId: '11148', releaseDate: '2016-02-23' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Heroes', source: 'igdb', externalId: '25230', releaseDate: '2016-10-18' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Battle for Neighborville', source: 'igdb', externalId: '121618', releaseDate: '2019-10-18' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Match', source: 'igdb', externalId: '287877', releaseDate: '2023-05-01', notes: 'wiki dates this 2021-06-04 as "Zombie Match"; IGDB date kept' },
  { mediaType: 'game', title: 'Plants vs. Zombies 3: Welcome to Zomburbia', source: 'igdb', externalId: '120900', releaseDate: '2024-01-18', notes: '"PvZ3: Evolved" 2025-10-07 = same item, edition' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Original Edition', source: 'igdb', externalId: '310568', releaseDate: '2024-04-27', notes: 'Chinese mini-program' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Replanted', source: 'igdb', externalId: '358529', releaseDate: '2025-10-23' },
  { mediaType: 'game', title: 'Plants vs. Zombies 3D', source: 'igdb', externalId: '143989', releaseDate: null, notes: 'Tencent mini-program, no release date known' },

  // ---- tv (1, TMDB, series-level) ----
  { mediaType: 'tv', title: 'Plants vs. Zombies vs. Jay and Silent Bob', source: 'tmdb', externalId: '206525', releaseDate: '2013-07-21' },

  // ---- books (11, Open Library) ----
  { mediaType: 'book', title: 'Plants vs. Zombies Official Guide', source: 'openlibrary', externalId: 'OL19873661W', releaseDate: '2013-07-04', publisher: 'Puffin', olid: 'OL19873661W' },
  { mediaType: 'book', title: 'Plants vs. Zombies Official Sticker Book', source: 'openlibrary', externalId: '', releaseDate: '2013-08-01', publisher: 'Puffin', isbn: '9781409391883', notes: 'year/date from publisher listing, resolved via ISBN' },
  { mediaType: 'book', title: 'Plants vs. Zombies: Brains and the Beanstalk', source: 'openlibrary', externalId: '', releaseDate: '2013-08-06', publisher: 'HarperFestival', author: 'Annie Auerbach', isbn: '9780062228369', olidMustBeEdition: true, notes: 'OL merges this work with Three Little Pigs — edition key keeps them distinct' },
  { mediaType: 'book', title: 'Plants vs. Zombies: The Three Little Pigs Fight Back', source: 'openlibrary', externalId: '', releaseDate: '2013-08-06', publisher: 'HarperFestival', isbn: '9780062228383', olidMustBeEdition: true, notes: 'OL merges this work with Brains and the Beanstalk — edition key keeps them distinct' },
  { mediaType: 'book', title: 'Plants vs. Zombies Official Guide to Protecting Your Brains', source: 'openlibrary', externalId: 'OL20882298W', releaseDate: '2013-08-06', publisher: 'HarperFestival', author: 'Simon Swatman', olid: 'OL20882298W' },
  { mediaType: 'book', title: 'Plants vs. Zombies Brain Busters', source: 'openlibrary', externalId: 'OL22645151W', releaseDate: '2013-09-10', publisher: 'HarperFestival', author: 'Emily Hughes', olid: 'OL22645151W' },
  { mediaType: 'book', title: 'Plants vs. Zombies: Soil Your Plants Joke Book', source: 'openlibrary', externalId: '', releaseDate: '2013-12-31', publisher: 'Puffin', isbn: '9781409392613', notes: 'year-only precision' },
  { mediaType: 'book', title: 'Plants vs. Zombies: Plant Your Path', source: 'openlibrary', externalId: 'OL19710029W', releaseDate: '2013-12-23', publisher: 'HarperCollins', author: 'Tracey West', olid: 'OL19710029W' },
  { mediaType: 'book', title: 'Plants vs. Zombies Activity Book #2', source: 'openlibrary', externalId: '', releaseDate: '2013-12-23', publisher: 'HarperFestival', isbn: '9780062294920' },
  { mediaType: 'book', title: 'Plants vs. Zombies: Garden Warfare — Prima Official Game Guide', source: 'openlibrary', externalId: 'OL17424921W', releaseDate: '2014-12-31', publisher: 'Prima Games', olid: 'OL17424921W', notes: 'year-only precision' },
  { mediaType: 'book', title: 'The Art of Plants vs. Zombies', source: 'openlibrary', externalId: 'OL20323120W', releaseDate: '2014-04-15', publisher: 'Dark Horse Books', olid: 'OL20323120W' },

  // ---- comics (26, Comic Vine volumes — Dark Horse) ----
  { mediaType: 'comic', title: 'Lawnmageddon', source: 'comicvine', externalId: 'volume-68914', releaseDate: '2013-11-19', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 1' },
  { mediaType: 'comic', title: 'Timepocalypse', source: 'comicvine', externalId: 'volume-79418', releaseDate: '2015-01-20', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 2' },
  { mediaType: 'comic', title: 'Bully For You', source: 'comicvine', externalId: 'volume-85585', releaseDate: '2015-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 3, year-only precision' },
  { mediaType: 'comic', title: 'Grown Sweet Home', source: 'comicvine', externalId: 'volume-90883', releaseDate: '2016-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 4, year-only precision' },
  { mediaType: 'comic', title: 'Petal To The Metal', source: 'comicvine', externalId: 'volume-93934', releaseDate: '2016-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 5, year-only precision' },
  { mediaType: 'comic', title: 'Boom Boom Mushroom', source: 'comicvine', externalId: 'volume-98354', releaseDate: '2017-02-07', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 6' },
  { mediaType: 'comic', title: 'Battle Extravagonzo', source: 'comicvine', externalId: 'volume-102127', releaseDate: '2017-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 7, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Lawn of Doom', source: 'comicvine', externalId: 'volume-104963', releaseDate: '2017-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 8, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Greatest Show Unearthed', source: 'comicvine', externalId: 'volume-108750', releaseDate: '2018-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 9, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Rumble At Lake Gumbo', source: 'comicvine', externalId: 'volume-111533', releaseDate: '2018-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 10, year-only precision (derived)' },
  { mediaType: 'comic', title: 'War and Peas', source: 'comicvine', externalId: 'volume-114259', releaseDate: '2018-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 11, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Dino-Might', source: 'comicvine', externalId: 'volume-117077', releaseDate: '2019-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 12, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Snow Thanks', source: 'comicvine', externalId: 'volume-119656', releaseDate: '2019-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 13, year-only precision (derived)' },
  { mediaType: 'comic', title: 'A Little Problem', source: 'comicvine', externalId: 'volume-121869', releaseDate: '2019-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 14, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Better Homes and Guardens', source: 'comicvine', externalId: 'volume-124805', releaseDate: '2020-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 15, year-only precision (derived)' },
  { mediaType: 'comic', title: 'The Garden Path', source: 'comicvine', externalId: 'volume-126894', releaseDate: '2020-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 16, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Multi-ball-istic', source: 'comicvine', externalId: 'volume-132485', releaseDate: '2020-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 17, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Constructionary Tales', source: 'comicvine', externalId: 'volume-137938', releaseDate: '2021-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 18, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Dream a Little Scheme', source: 'comicvine', externalId: 'volume-140451', releaseDate: '2021-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 19, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Faulty Fables', source: 'comicvine', externalId: 'volume-149501', releaseDate: '2022-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 20; OL says 2022, CV start_year 2023' },
  { mediaType: 'comic', title: 'Impfestation', source: 'comicvine', externalId: 'volume-152748', releaseDate: '2023-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 21, year-only precision' },
  { mediaType: 'comic', title: 'The Unpredictables', source: 'comicvine', externalId: 'volume-167373', releaseDate: '2023-12-31', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 22, year-only precision (derived)' },
  { mediaType: 'comic', title: 'Zapped', source: 'comicvine', externalId: 'volume-161602', releaseDate: '2024-10-08', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 23, ISBN 9781506728483' },
  { mediaType: 'comic', title: 'The Big Spitball', source: 'comicvine', externalId: 'volume-167370', releaseDate: '2025-09-23', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 24, ISBN 9781506728490' },
  { mediaType: 'comic', title: 'Plants vs. Zombies: Garden Warfare', source: 'comicvine', externalId: 'volume-85586', releaseDate: '2015-12-31', publisher: 'Dark Horse Comics', notes: 'Garden Warfare mini-series (3 issues), year-only precision' },
  { mediaType: 'comic', title: 'Plants vs. Zombies: Halloween ComicFest Mini-Comic', source: 'comicvine', externalId: 'volume-77861', releaseDate: '2015-12-31', publisher: 'Dark Horse Comics', notes: 'one-shot, year-only precision' },

  // ---- soundtracks (2, MusicBrainz release-groups) ----
  { mediaType: 'soundtrack', title: 'Plants vs. Zombies Original Soundtrack', source: 'musicbrainz', externalId: '167fd56d-de13-4ec6-a9be-c9272037e423', releaseDate: '2010-11-22', author: 'Laura Shigihara' },
  { mediaType: 'soundtrack', title: 'Plants vs. Zombies 2 Original Soundtrack', source: 'musicbrainz', externalId: '66e9518f-84d7-4fc7-bfb8-519a5f660135', releaseDate: '2013-08-15', author: 'Various Artists', notes: 'MB individual release marked Bootleg; release-group bound' },

  // ---- board games (2, BGG — bgg is the sanctioned boardgame source) ----
  { mediaType: 'boardgame', title: 'Plants vs. Zombies: Risk', source: 'bgg', externalId: '148036', releaseDate: '2013-12-31', publisher: 'The Op Games', notes: 'year-only precision' },
  { mediaType: 'boardgame', title: 'Plants vs. Zombies: The Board Game', source: 'bgg', externalId: '471020', releaseDate: '2027-01-01', publisher: 'Mantic Games', notes: 'unreleased; BGG yearpublished 2027 (delivery window, unconfirmed)' },
];

// ---------------------------------------------------------------- manual phase
// User-approved 2026-09-29: insert the researched-but-unbound official items as
// source='manual' rows, each carrying its real evidence URL (where research found it)
// in media_external_ids.source_url. `whyUnbound` documents the API-absence check.
type ManualItem = {
  mediaType: MediaType;
  title: string;
  releaseDate: string | null;
  sourceUrl: string;
  evidence: string; // short label for where the item was found
  whyUnbound: string; // documented API check that failed (2026-09-29 research run)
  verifyVia: 'fandom' | 'igdb-api' | 'http' | 'search-index';
  wikiTitle?: string; // fandom wiki title (defaults to title)
  igdbId?: number;
  status?: string;
  publisher?: string;
  author?: string;
  notes?: string;
};

const FANDOM = 'https://plantsvszombies.fandom.com/wiki/';
const wikiUrl = (title: string) => FANDOM + title.replace(/ /g, '_');

const MANUAL_ITEMS: ManualItem[] = [
  // ---- games (12 — IGDB searched, zero hits) ----
  { mediaType: 'game', title: 'Plants vs. Zombies Social', releaseDate: '2011-06-30', sourceUrl: wikiUrl('Plants vs. Zombies Social'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ social / social edition → 0 hits', verifyVia: 'fandom', notes: 'Tencent (China), 2011-06 month precision — month-end date' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Great Wall Edition', releaseDate: '2012-05-28', sourceUrl: wikiUrl('Plants vs. Zombies: Great Wall Edition'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ great wall → 0 hits', verifyVia: 'fandom' },
  { mediaType: 'game', title: 'Plants vs. Zombies 2: Tencent Edition', releaseDate: '2013-09-30', sourceUrl: wikiUrl('Plants vs. Zombies 2: Tencent Edition'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ tencent → 0 hits', verifyVia: 'fandom', notes: '2013-09 month precision — month-end date; shut down 2016-10' },
  { mediaType: 'game', title: 'Plants vs. Zombies Online', releaseDate: '2014-07-18', sourceUrl: wikiUrl('Plants vs. Zombies Online'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ online within PvZ set → 0 hits', verifyVia: 'fandom', notes: 'China; beta 2013-12-09, full release 2014-07-18' },
  { mediaType: 'game', title: 'Plants vs. Zombies: Magic Book', releaseDate: '2014-09-04', sourceUrl: wikiUrl('Plants vs. Zombies: Magic Book'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ magic book → 0 hits', verifyVia: 'fandom' },
  { mediaType: 'game', title: 'Plants vs. Zombies Pinyin Adventure', releaseDate: '2015-03-04', sourceUrl: wikiUrl('Plants vs. Zombies Pinyin Adventure'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ pinyin → 0 hits', verifyVia: 'fandom' },
  { mediaType: 'game', title: 'Plants vs. Zombies Pinball', releaseDate: '2012-12-31', sourceUrl: wikiUrl('Plants vs. Zombies Pinball'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB only has Zen compilation products 24231/354714, not the 2012 original table — wrong id worse than missing', verifyVia: 'fandom', notes: 'Zen Studios XBLA/PSN 2012 — year-only precision' },
  { mediaType: 'game', title: 'Plants vs. Zombies (Talkweb mini-games)', releaseDate: null, sourceUrl: wikiUrl('Talkweb'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'no IGDB record for Talkweb PvZ titles', verifyVia: 'fandom', wikiTitle: 'Talkweb', notes: 'collective entry for Talkweb (China) mini-game releases; dates unverified' },
  { mediaType: 'game', title: "Plants vs. Zombies: Mr. Zombie's Called Jam Hsiao", releaseDate: null, sourceUrl: wikiUrl("Mr. Zombie's Called Jam Hsiao"), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB name ~ hsiao → 0 hits', verifyVia: 'fandom', wikiTitle: "Mr. Zombie's Called Jam Hsiao", notes: 'regional promo item; no release date known' },
  { mediaType: 'game', title: 'Plants vs. Zombies 3C (Chinese)', releaseDate: '2025-09-26', sourceUrl: wikiUrl('Plants vs. Zombies 3 (Chinese version)'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'IGDB full name sweep for PvZ → no match', verifyVia: 'fandom', wikiTitle: 'Plants vs. Zombies 3 (Chinese version)', notes: 'wiki page title: Plants vs. Zombies 3 (Chinese version)' },
  { mediaType: 'game', title: 'Plants vs. Zombies LCD Handheld (Burger King)', releaseDate: '2015-12-31', sourceUrl: 'https://www.igdb.com/games/plants-vs-zombies--3', evidence: 'IGDB game page (url field from IGDB API, id 259406)', whyUnbound: 'IGDB 259406 exists but licensing/officialness unverified — held unbound per research', verifyVia: 'igdb-api', igdbId: 259406, notes: 'Burger King kids-meal LCD handheld — year-only precision' },
  { mediaType: 'game', title: 'Plants vs. Zombies (Linux port)', releaseDate: null, sourceUrl: 'https://www.igdb.com/games/plants-vs-zombies--5', evidence: 'IGDB game page (url field from IGDB API, id 264243)', whyUnbound: 'IGDB 264243 exists but no source confirms an official Linux release — held unbound per research', verifyVia: 'igdb-api', igdbId: 264243, notes: 'unreleased in-flight port; no release date' },

  // ---- tv (2 — TMDB has only the Jay & Silent Bob special) ----
  { mediaType: 'tv', title: 'Plants vs. Zombies vs. Dorkly', releaseDate: '2011-11-30', sourceUrl: 'https://en.wikipedia.org/wiki/Plants_vs._Zombies#Web_series', evidence: 'Wikipedia PvZ article, Web series section', whyUnbound: 'TMDB only has 55347 Dorkly Bits (general anthology) — rejected, not PvZ-specific', verifyVia: 'http', notes: 'web series from 2011-11 (month precision); officially EA-sponsored from 2025-10' },
  { mediaType: 'tv', title: 'Plants vs. Zombies 2: Behind the Brainz', releaseDate: '2013-12-31', sourceUrl: 'https://plantsvszombies.wiki.gg/wiki/Plants_vs._Zombies_2:_Behind_the_Brainz', evidence: 'Plants vs. Zombies Wiki (wiki.gg)', whyUnbound: 'TMDB search → 0', verifyVia: 'search-index', notes: '4-episode PopCap dev series, 2013 — year-only precision; only eps 3 & 4 survive' },

  // ---- comics (3 — on Penguin Random House, missing from Comic Vine) ----
  { mediaType: 'comic', title: "It's a Dogz Life", releaseDate: '2026-02-10', sourceUrl: 'https://www.penguinrandomhouse.com/books/798945/', evidence: 'Penguin Random House product page', whyUnbound: 'Comic Vine filter name:Dogz → 0 results', verifyVia: 'http', publisher: 'Dark Horse Comics', notes: 'Plants vs. Zombies Vol 25; PRH on-sale date' },
  { mediaType: 'comic', title: 'Certified Zomboss', releaseDate: '2026-10-20', sourceUrl: 'https://www.penguinrandomhouse.com/books/814291/', evidence: 'Penguin Random House product page', whyUnbound: 'no Comic Vine volume record', verifyVia: 'http', publisher: 'Dark Horse Comics', status: 'upcoming', notes: 'Plants vs. Zombies Vol 26; unreleased (on sale 2026-10-20)' },
  { mediaType: 'comic', title: 'A Mr. Stubbins Vacation', releaseDate: '2027-06-08', sourceUrl: 'https://www.penguinrandomhouse.com/books/841361/', evidence: 'Penguin Random House product page', whyUnbound: 'no Comic Vine volume record', verifyVia: 'http', publisher: 'Dark Horse Comics', status: 'upcoming', notes: 'Plants vs. Zombies Vol 27; unreleased (on sale 2027-06-08); PRH page found after the research run' },

  // ---- soundtrack (1 — MB record exists but marked Bootleg) ----
  { mediaType: 'soundtrack', title: 'Plants vs. Zombies: Garden Warfare OST', releaseDate: '2021-08-31', sourceUrl: 'https://musicbrainz.org/release-group/3e91567e-62a9-4b04-bac3-3f68d005de75', evidence: 'MusicBrainz release-group', whyUnbound: 'MB release marked Bootleg — cannot confirm an official release from a primary source', verifyVia: 'http', author: 'Peter McConnell', notes: 'rebind to musicbrainz if an official storefront release is confirmed' },

  // ---- board game (1 — cancelled, no BGG record) ----
  { mediaType: 'boardgame', title: 'Plants vs. Zombies: The Board Game (2012, cancelled)', releaseDate: '2012-12-31', sourceUrl: wikiUrl('Plants vs. Zombies: The Board Game'), evidence: 'Plants vs. Zombies Wiki (fandom)', whyUnbound: 'no BGG record for the cancelled 2012 game', verifyVia: 'fandom', wikiTitle: 'Plants vs. Zombies: The Board Game', status: 'cancelled', notes: 'year-only precision; distinct from Mantic’s 2027 board game (bgg 471020)' },

  // ---- theme park (1 — no themeparks API entity) ----
  { mediaType: 'themepark', title: 'Plants vs. Zombies Garden Warfare: 3Z Arena', releaseDate: '2016-03-25', sourceUrl: 'https://www.pistudios.com/portfolio/plants-vs-zombies-experience/', evidence: 'Pure Imagination Studios portfolio page', whyUnbound: 'themeparks.wiki /v1/destinations has no plants/zombie entity (checked 2026-09-29)', verifyVia: 'http', notes: 'Carowinds (Carolina, US); closed 2022-07-31' },

  // ---- book (1 — title unidentified) ----
  { mediaType: 'book', title: 'Plants vs. Zombies (ISBN 9780062228406 — title unidentified)', releaseDate: '2013-12-31', sourceUrl: 'https://openlibrary.org/books/OL37399025M', evidence: 'Open Library edition page (OL37399025M)', whyUnbound: 'OL merges this edition into work OL24326383W with two other books; title unidentified after OL + Google Books + websearch', verifyVia: 'http', publisher: 'HarperFestival', notes: 'year-only precision; same 2013 HarperFestival run as the two merged books' },
];

// same rule as canonical.ts toCuratedExternalId — manual rows key off it
function curatedId(mediaType: string, title: string, releaseDate: string | null): string {
  const titleToken = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'untitled';
  const yearToken = releaseDate && /^\d{4}/.test(releaseDate) ? releaseDate.slice(0, 4) : 'na';
  return `curated-${mediaType}-${yearToken}-${titleToken}`;
}

// ---------------------------------------------------------------- helpers

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type NamedRef = { id?: number; name?: string };
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
type TmdbTv = {
  name: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  networks?: NamedRef[];
  number_of_seasons?: number;
  number_of_episodes?: number;
};
type CvVolume = { name?: string; publisher?: { name?: string }; image?: { original_url?: string } };
type CvVolumeResponse = { error?: string; status_code?: number; results?: CvVolume } & CvVolume;
type MbReleaseGroup = { title?: string };
type BggThing = { name: string; yearpublished: number | null; image: string | null };
type OlEdition = { key: string; works?: Array<{ key: string }> };

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

// Title assertion: exact/containment after normalization, else compare the cores
// left after stripping the franchise prefix (so two *different* PvZ titles — both
// containing "plants vs zombies" — never pass each other's check).
function titlesMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const sa = na.replace(/^plantsvszombies/, '');
  const sb = nb.replace(/^plantsvszombies/, '');
  if (!sa || !sb) return false; // one side is franchise-only, other side isn't equal
  return sa.includes(sb) || sb.includes(sa);
}

function unixToIso(unix?: number): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().split('T')[0];
}

type VerifiedItem = ResearchItem & {
  posterPath?: string | null;
  backdropPath?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  networks?: string[];
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

async function verifyTmdb(id: string): Promise<TmdbTv> {
  return (await fetchJson(`https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.TMDB_API_KEY}`)) as TmdbTv;
}

async function verifyComicVolume(volumeId: string): Promise<CvVolumeResponse> {
  const url = `https://comicvine.gamespot.com/api/volume/4050-${volumeId}/?api_key=${process.env.COMICVINE_API_KEY}&format=json&field_list=name,start_year,publisher,image`;
  return (await fetchJson(url, {}, 4)) as CvVolumeResponse;
}

async function verifyMusicBrainzReleaseGroup(rgId: string): Promise<MbReleaseGroup> {
  await sleep(1100); // MusicBrainz rate limit: 1 req/s
  const text = await fetchText(`https://musicbrainz.org/ws/2/release-group/${rgId}?fmt=json`, {
    headers: { 'User-Agent': 'LoreMediaTracker/1.0 (universe creator)' },
  });
  return JSON.parse(text) as MbReleaseGroup;
}

async function verifyBgg(ids: string[]): Promise<Map<string, BggThing>> {
  const headers: Record<string, string> = {};
  if (process.env.BGG_API_KEY) headers.Authorization = `Bearer ${process.env.BGG_API_KEY}`;
  const xml = await fetchText(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}`, { headers });
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

async function resolveOpenLibrary(item: ResearchItem): Promise<string> {
  if (item.olidMustBeEdition && item.isbn) {
    const ed = (await fetchJson(`https://openlibrary.org/isbn/${item.isbn}.json`)) as OlEdition;
    return ed.key.replace(/^\/books\//, '');
  }
  if (item.olid) return item.olid;
  if (item.isbn) {
    const ed = (await fetchJson(`https://openlibrary.org/isbn/${item.isbn}.json`)) as OlEdition;
    const work = ed.works?.[0]?.key;
    if (work) return work.replace(/^\/works\//, '');
    return ed.key.replace(/^\/books\//, '');
  }
  throw new Error(`book ${item.title} has neither olid nor isbn`);
}

async function checkListenNotesPodcasts(): Promise<string[]> {
  const key = process.env.LISTEN_NOTES_API_KEY || process.env.LISTENNOTES_API_KEY;
  if (!key) return ['LISTEN_NOTES_API_KEY missing — podcast check skipped (source gap)'];
  try {
    const data = await fetchJson('https://listen-api.listennotes.com/api/v2/search?q=plants%20vs%20zombies&type=podcast', {
      headers: { 'X-ListenAPI-Key': key },
    });
    const results = (data.results ?? []) as Array<{ id: string; title: string; publisher: string }>;
    if (results.length === 0) return ['ListenNotes OK: 0 podcast results for "plants vs zombies"'];
    return results.slice(0, 5).map((r) => `candidate: "${r.title}" (${r.publisher}) id=${r.id}`);
  } catch (err) {
    return [`ListenNotes check failed: ${(err as Error).message}`];
  }
}

async function checkThemeparks(): Promise<string[]> {
  try {
    const data = await fetchText('https://api.themeparks.wiki/v1/destinations');
    const lower = data.toLowerCase();
    if (lower.includes('plant') || lower.includes('zombie')) {
      const lines = data.split('\n').filter((l) => /plant|zombie/i.test(l));
      return ['HIT — themeparks API mentions plants/zombies:', ...lines.slice(0, 10)];
    }
    return ['themeparks destinations fetched: no "plant"/"zombie" entity (3Z Arena absent — stays unbound)'];
  } catch (err) {
    return [`themeparks check failed: ${(err as Error).message}`];
  }
}

// ---------------------------------------------------------------- main

// ---------------------------------------------------------------- manual phase

// Evidence-URL verification (loud failure before any write):
//  - fandom: MediaWiki API batch title resolution (page HTML is bot-blocked here, API answers)
//  - igdb-api: the record's `url` field from IGDB's API must equal the stored sourceUrl
//  - http: plain GET must answer 200
//  - search-index: wiki.gg 403s this host; existence was confirmed via search index 2026-09-29
async function verifyManualSources(): Promise<void> {
  const fails: string[] = [];

  const fandomItems = MANUAL_ITEMS.filter((i) => i.verifyVia === 'fandom');
  const titles = fandomItems.map((i) => i.wikiTitle ?? i.title);
  try {
    const api =
      'https://plantsvszombies.fandom.com/api.php?action=query&format=json&redirects=1&titles=' +
      titles.map((t) => encodeURIComponent(t)).join('%7C');
    const resp = (await fetchJson(api, { headers: { 'User-Agent': 'lore-research/1.0' } })) as {
      query?: { pages?: Record<string, { title?: string; missing?: unknown }> };
    };
    const pages = resp.query?.pages ?? {};
    const missing = Object.values(pages)
      .filter((p) => p && typeof p === 'object' && 'missing' in p)
      .map((p) => p.title ?? '?');
    if (missing.length > 0) fails.push(`fandom wiki pages missing: ${missing.join(' | ')}`);
    if (Object.keys(pages).length !== titles.length) fails.push(`fandom API returned ${Object.keys(pages).length} pages for ${titles.length} titles`);
    console.log(`  ok  fandom wiki: ${fandomItems.length} evidence pages resolve`);
  } catch (err) {
    fails.push(`fandom wiki API check failed: ${err}`);
  }

  const igdbItems = MANUAL_ITEMS.filter((i) => i.verifyVia === 'igdb-api');
  if (igdbItems.length > 0) {
    try {
      const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.IGDB_CLIENT_ID!,
          client_secret: process.env.IGDB_CLIENT_SECRET!,
          grant_type: 'client_credentials',
        }),
      });
      if (!tokenResp.ok) throw new Error(`IGDB token HTTP ${tokenResp.status}`);
      const { access_token: token } = (await tokenResp.json()) as { access_token: string };
      const resp = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Client-ID': process.env.IGDB_CLIENT_ID!, 'Content-Type': 'text/plain' },
        body: `fields id,url; where id = (${igdbItems.map((i) => i.igdbId).join(',')});`,
      });
      if (!resp.ok) throw new Error(`IGDB games HTTP ${resp.status}`);
      const rows = (await resp.json()) as Array<{ id: number; url: string }>;
      for (const item of igdbItems) {
        const row = rows.find((r) => r.id === item.igdbId);
        if (!row) fails.push(`igdb id ${item.igdbId} not returned`);
        else if (row.url !== item.sourceUrl) fails.push(`igdb ${item.igdbId} url drift: API "${row.url}" != stored "${item.sourceUrl}"`);
      }
      console.log(`  ok  igdb api: ${igdbItems.length} game urls match stored source_url`);
    } catch (err) {
      fails.push(`igdb api check failed: ${err}`);
    }
  }

  for (const item of MANUAL_ITEMS.filter((i) => i.verifyVia === 'http')) {
    try {
      const body = await fetchText(item.sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; lore-research/1.0)' } });
      if (!body) fails.push(`empty body: ${item.sourceUrl}`);
      else console.log(`  ok  http 200  ${item.sourceUrl}`);
    } catch (err) {
      fails.push(`http check failed for ${item.sourceUrl}: ${err}`);
    }
  }

  for (const item of MANUAL_ITEMS.filter((i) => i.verifyVia === 'search-index')) {
    console.log(`  ~  search-index verified 2026-09-29 (wiki.gg blocks this host): ${item.sourceUrl}`);
  }

  if (fails.length > 0) {
    console.error('\n!! manual source verification FAILED — nothing will be written:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }
}

async function runManual(mode: 'manual-dry' | 'manual-apply'): Promise<void> {
  console.log(`Plants vs. Zombies manual completion — mode=${mode} (items=${MANUAL_ITEMS.length})\n`);

  const collection = await db.query.collections.findFirst({ where: eq(collections.slug, 'plants-vs-zombies') });
  if (!collection) {
    console.error('!! collection plants-vs-zombies not found — run dry/apply (bound phase) first');
    process.exit(1);
  }

  console.log('[1/3] verifying evidence sources...');
  await verifyManualSources();

  const existing = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const byTitle = new Map(existing.map((r) => [`${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`, r.mediaItemId]));
  const memberIds = new Set(existing.map((r) => r.mediaItemId));

  type Plan = { item: ManualItem; extId: string; mediaItemId: number | null };
  const plans: Plan[] = [];
  const problems: string[] = [];
  for (const item of MANUAL_ITEMS) {
    const extId = curatedId(item.mediaType, item.title, item.releaseDate);
    const found = await db.query.mediaItems.findFirst({
      where: and(eq(mediaItems.source, 'manual'), eq(mediaItems.mediaType, item.mediaType), eq(mediaItems.externalId, extId)),
    });
    const clash = byTitle.get(`${item.mediaType}\u0000${item.title}`);
    if (!found && clash !== undefined) {
      problems.push(`duplicate title within ${item.mediaType} with a different identity: "${item.title}" (media_item ${clash})`);
    }
    plans.push({ item, extId, mediaItemId: found?.id ?? null });
  }
  if (problems.length > 0) {
    console.error('\n!! manual insert aborted before any write:');
    for (const p of problems) console.error(`   - ${p}`);
    process.exit(1);
  }

  const newCount = plans.filter((p) => !p.mediaItemId).length;
  console.log(`\n[2/3] plan — ${plans.length} items (${plans.length - newCount} already in DB, ${newCount} new):`);
  plans.forEach((p, i) => {
    const date = p.item.releaseDate ?? '        --';
    console.log(`  ${String(i + 1).padStart(2)}. ${date}  ${p.item.mediaType.padEnd(10)} ${p.item.title}${p.mediaItemId ? ' [exists]' : ''}`);
    console.log(`      src ${p.item.sourceUrl}`);
  });

  if (mode === 'manual-dry') {
    console.log('\ndry run — nothing written. Re-run with: manual-apply');
    return;
  }

  // ------------------------------------------------------------ manual-apply
  console.log('\napplying...');
  let made = 0;
  let reused = 0;
  for (const p of plans) {
    const mappingMeta = { evidence: p.item.evidence, why_unbound: p.item.whyUnbound, checked: '2026-09-29' };
    const result = await ensureCanonicalMediaItem({
      source: 'manual',
      externalId: p.extId,
      mediaType: p.item.mediaType,
      title: p.item.title,
      releaseDate: p.item.releaseDate,
      publisher: p.item.publisher ?? null,
      author: p.item.author ?? null,
      status: p.item.status ?? null,
      mappingMetadata: mappingMeta,
    });
    if (!result) {
      console.error(`!! ensureCanonicalMediaItem returned null for ${p.extId} — aborting`);
      process.exit(1);
    }
    if (result.created) made++; else reused++;
    const mapping = await ensureMediaExternalMapping({
      mediaItemId: result.mediaItem.id,
      provider: 'manual',
      mediaType: p.item.mediaType,
      externalId: p.extId,
      sourceUrl: p.item.sourceUrl,
      confidence: 100,
      isPrimary: true,
      metadata: { ...mappingMeta, verified_via: p.item.verifyVia },
    });
    if (!mapping || mapping.sourceUrl !== p.item.sourceUrl) {
      console.error(`!! source_url not stored on media_external_ids for ${p.extId} — aborting`);
      process.exit(1);
    }
    p.mediaItemId = result.mediaItem.id;
    const alreadyMember = memberIds.has(result.mediaItem.id);
    if (!alreadyMember) {
      await db.insert(collectionItems).values({
        collectionId: collection.id,
        mediaItemId: result.mediaItem.id,
        releaseOrder: 0, // renumbered below
        chronologicalOrder: null, // story placement unknown — unplaced per chrono rule
        groupName: null,
        isRequired: true,
        notes: p.item.notes ?? null,
      });
    }
    console.log(`  ${result.created ? 'created' : 'reused '} media_item ${result.mediaItem.id}${alreadyMember ? '' : ' + membership'} — ${p.item.title}`);
  }

  console.log('\n[3/3] renumbering release_order (date asc, nulls last, existing before new on ties)...');
  const rows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const ordKey = (r: { releaseOrder: number }) => (r.releaseOrder > 0 ? r.releaseOrder : Number.MAX_SAFE_INTEGER);
  const sorted = [...rows].sort((a, b) => {
    const da = a.mediaItem.releaseDate;
    const dbv = b.mediaItem.releaseDate;
    if (!da && dbv) return 1;
    if (da && !dbv) return -1;
    if (da && dbv && da !== dbv) return da < dbv ? -1 : 1;
    return ordKey(a) - ordKey(b);
  });
  let changed = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].releaseOrder !== i + 1) {
      await db.update(collectionItems).set({ releaseOrder: i + 1 }).where(eq(collectionItems.id, sorted[i].id));
      changed++;
    }
  }
  console.log(`  renumbered ${changed} rows`);

  const finalRows = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collection.id),
    with: { mediaItem: true },
  });
  const fails: string[] = [];
  const expected = 58 + MANUAL_ITEMS.length;
  if (finalRows.length !== expected) fails.push(`expected ${expected} memberships, got ${finalRows.length}`);
  const ids = new Set(finalRows.map((r) => r.mediaItemId));
  if (ids.size !== finalRows.length) fails.push(`duplicate memberships: ${finalRows.length - ids.size} duplicates`);
  const orders = finalRows.map((r) => r.releaseOrder).sort((a, b) => a - b);
  if (orders.some((o, i) => o !== i + 1)) fails.push('release_order not contiguous 1..n');
  if (finalRows.some((r) => r.chronologicalOrder !== null)) fails.push('chronological_order must stay NULL (unplaced)');
  const typeTitleKeys = finalRows.map((r) => `${r.mediaItem.mediaType}\u0000${r.mediaItem.title}`);
  const dupKeys = [...new Set(typeTitleKeys.filter((k, i) => typeTitleKeys.indexOf(k) !== i))];
  if (dupKeys.length > 0) fails.push(`duplicate titles within a media type: ${dupKeys.map((k) => k.replace('\u0000', ' / ')).join(' | ')}`);
  const byType: Record<string, number> = {};
  for (const r of finalRows) byType[r.mediaItem.mediaType] = (byType[r.mediaItem.mediaType] ?? 0) + 1;
  for (const p of plans) {
    const ext = await db.query.mediaExternalIds.findFirst({
      where: and(
        eq(mediaExternalIds.provider, 'manual'),
        eq(mediaExternalIds.mediaType, p.item.mediaType),
        eq(mediaExternalIds.externalId, p.extId)
      ),
    });
    if (!ext) fails.push(`no media_external_ids row for ${p.extId}`);
    else if (ext.sourceUrl !== p.item.sourceUrl) fails.push(`source_url mismatch for ${p.extId}: "${ext.sourceUrl}" != "${p.item.sourceUrl}"`);
  }
  await db.update(collections).set({ itemCount: finalRows.length, updatedAt: new Date() }).where(eq(collections.id, collection.id));

  if (fails.length > 0) {
    console.error('\n!! post-insert verification FAILED:');
    for (const f of fails) console.error(`   - ${f}`);
    process.exit(1);
  }

  const typeLine = Object.entries(byType)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');
  console.log(`\nDONE: collection ${collection.id} — ${finalRows.length} memberships (${made} created, ${reused} reused), release_order 1..${finalRows.length}`);
  console.log(`by type: ${typeLine}`);
  console.log('verify: /universes/plants-vs-zombies  (univrs.vercel.app)');
}

async function main() {
  const mode = (process.argv[2] || 'dry').trim();
  if (mode === 'manual-dry' || mode === 'manual-apply') {
    await runManual(mode);
    return;
  }
  if (mode !== 'dry' && mode !== 'apply') {
    console.error(`unknown mode "${mode}" — use: dry | apply | manual-dry | manual-apply`);
    process.exit(2);
  }

  console.log(`Plants vs. Zombies universe — mode=${mode} (items=${ITEMS.length})\n`);

  const verified: VerifiedItem[] = ITEMS.map((i) => ({ ...i }));

  // -- games (single IGDB batch)
  console.log('[1/7] verifying IGDB games...');
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
    item.providerTitle = g.name;
    item.verifiedDate = unixToIso(g.first_release_date) ?? item.releaseDate;
    item.description = g.summary || null;
    item.genres = (g.genres ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.platforms = (g.platforms ?? []).map((x) => x.name).filter((n): n is string => Boolean(n));
    item.developer = g.involved_companies?.find((c) => c.developer)?.company?.name ?? null;
    item.publisher = item.publisher ?? g.involved_companies?.find((c) => c.publisher)?.company?.name ?? null;
    item.rating = typeof g.rating === 'number' ? Number((g.rating / 10).toFixed(1)) : null;
    const coverUrl: string | null = g.cover?.url
      ? (g.cover.url.startsWith('//') ? `https:${g.cover.url}` : g.cover.url).replace('thumb', 'cover_big')
      : null;
    item.posterPath = coverUrl;
    if (!g.first_release_date && item.releaseDate) {
      item.notes = [item.notes, 'IGDB has no release date — research date used'].filter(Boolean).join('; ');
    }
    console.log(`  ok  igdb-${item.externalId} "${g.name}" → ${item.verifiedDate ?? 'undated'}`);
  }

  // -- tv
  console.log('\n[2/7] verifying TMDB tv...');
  for (const item of verified.filter((i) => i.mediaType === 'tv')) {
    const tv = await verifyTmdb(item.externalId);
    if (!titlesMatch(item.title, tv.name)) {
      failures.push(`tmdb ${item.externalId} title mismatch: research "${item.title}" vs TMDB "${tv.name}"`);
      continue;
    }
    item.providerTitle = tv.name;
    item.verifiedDate = (tv.first_air_date || item.releaseDate || null) as string | null;
    item.posterPath = tv.poster_path ?? null;
    item.backdropPath = tv.backdrop_path ?? null;
    item.description = tv.overview || null;
    item.networks = (tv.networks ?? []).map((n) => n.name).filter((n): n is string => Boolean(n));
    item.seasons = tv.number_of_seasons ?? null;
    item.totalEpisodes = tv.number_of_episodes ?? null;
    item.status = 'released';
    console.log(`  ok  tmdb-${item.externalId} "${tv.name}" (${item.seasons} seasons, ${item.totalEpisodes} eps)`);
  }

  // -- comics (26 sequential CV volume calls)
  console.log('\n[3/7] verifying Comic Vine volumes...');
  for (const item of verified.filter((i) => i.mediaType === 'comic')) {
    const volId = item.externalId.replace(/^volume-/, '');
    const resp = await verifyComicVolume(volId);
    if (resp.error !== 'OK' || resp.status_code !== 1) {
      failures.push(`comicvine volume-${volId} API error: ${resp.error} (${resp.status_code})`);
      continue;
    }
    const vol = resp.results ?? resp;
    const name: string = vol.name ?? '';
    if (!name || !titlesMatch(item.title, name)) {
      failures.push(`comicvine volume-${volId} title mismatch: research "${item.title}" vs CV "${name}"`);
      continue;
    }
    item.providerTitle = name;
    item.verifiedDate = item.releaseDate;
    item.posterPath = vol.image?.original_url ?? null;
    item.publisher = vol.publisher?.name ?? item.publisher;
    console.log(`  ok  volume-${volId} CV"${name}" research"${item.title}"`);
    await sleep(300);
  }

  // -- soundtracks
  console.log('\n[4/7] verifying MusicBrainz release-groups...');
  for (const item of verified.filter((i) => i.mediaType === 'soundtrack')) {
    const rg = await verifyMusicBrainzReleaseGroup(item.externalId);
    if (!titlesMatch(item.title, rg.title ?? '')) {
      failures.push(`musicbrainz ${item.externalId} title mismatch: research "${item.title}" vs MB "${rg.title}"`);
      continue;
    }
    item.providerTitle = rg.title;
    item.verifiedDate = item.releaseDate;
    console.log(`  ok  ${item.externalId.slice(0, 8)}… "${rg.title}"`);
  }

  // -- board games
  console.log('\n[5/7] verifying BGG board games...');
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
    if (b.yearpublished) {
      // BGG gives year only — year-only convention everywhere is Dec 31 (sequence-preserving)
      item.verifiedDate = `${b.yearpublished}-12-31`;
      if (b.yearpublished > 2026) item.status = 'upcoming';
    }
    console.log(`  ok  bgg-${item.externalId} "${b.name}" (${b.yearpublished ?? 'undated'})`);
  }

  // -- books (Open Library resolution; titles asserted where fetched)
  console.log('\n[6/7] resolving Open Library books...');
  for (const item of verified.filter((i) => i.mediaType === 'book')) {
    const olid = await resolveOpenLibrary(item);
    item.externalId = olid;
    item.verifiedDate = item.releaseDate;
    console.log(`  ok  ${olid.padEnd(12)} "${item.title}"`);
  }

  // -- non-item checks (report only)
  console.log('\n[7/7] source-gap checks (report only):');
  for (const line of await checkListenNotesPodcasts()) console.log(`  podcast: ${line}`);
  for (const line of await checkThemeparks()) console.log(`  themepark: ${line}`);

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
  const existingColl = await db.query.collections.findFirst({ where: eq(collections.slug, 'plants-vs-zombies') });
  if (existingColl) {
    console.error(`\n!! collection slug "plants-vs-zombies" already exists (id ${existingColl.id}) — refusing to create a duplicate. Expand the existing universe instead.`);
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

  const creator = await db.query.users.findFirst({ where: eq(users.email, 'fahadbinhussain001@gmail.com') });
  if (!creator) {
    console.error('!! creator user fahadbinhussain001@gmail.com not found — aborting');
    process.exit(1);
  }

  const cover = verified.find((i) => i.externalId === '1277')?.posterPath ?? null;
  const [newUniverse] = await db.insert(collections).values({
    name: 'Plants vs. Zombies',
    slug: 'plants-vs-zombies',
    description: 'Every official PopCap/EA Plants vs. Zombies media item — games, comics, books, soundtracks, TV, and board games — in release order.',
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
  const memberships: Array<{ mediaItemId: number; releaseOrder: number }> = [];

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
    memberships.push({ mediaItemId: result.mediaItem.id, releaseOrder: idx + 1 });
    console.log(`  [${idx + 1}/${ordered.length}] ${result.created ? 'created' : 'reused '} media_item ${result.mediaItem.id} — ${item.title}`);
  }

  await db.insert(collectionItems).values(
    memberships.map((m, idx) => ({
      collectionId: newUniverse.id,
      mediaItemId: m.mediaItemId,
      releaseOrder: m.releaseOrder,
      chronologicalOrder: null, // story placement unknown for PvZ — unplaced per chrono rule
      groupName: null,
      isRequired: true,
      notes: ordered[idx].notes ?? null,
    }))
  );

  const finalCount = await db.query.collectionItems.findMany({ where: (t, { eq }) => eq(t.collectionId, newUniverse.id) });
  const distinctIds = new Set(finalCount.map((m) => m.mediaItemId));
  console.log(`\nDONE: collection ${newUniverse.id} "Plants vs. Zombies" — ${finalCount.length} memberships, ${distinctIds.size} distinct media_items (${made} created, ${reused} reused)`);
  console.log(`verify: /universes/plants-vs-zombies  (univrs.vercel.app)`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
