export interface VndbVN {
  id: string;
  title: string;
  aliases?: string[] | null;
  released?: string | null;
  description?: string | null;
  platforms?: string[] | null;
  languages?: string[] | null;
  developers?: Array<{ id: string; name: string }> | null;
  image?: { url: string | null; thumbnail?: string | null } | null;
  screenshots?: Array<{ url: string }> | null;
  tags?: Array<{ name: string; category?: string; rating?: number }> | null;
  length_minutes?: number | null;
  extlinks?: Array<{ label: string; url: string }> | null;
  rating?: number | null;
  votecount?: number | null;
}

interface VndbSearchResponse {
  more?: boolean;
  results?: VndbVN[];
}

const VNDB_BASE_URL = 'https://api.vndb.org/kana';

async function postVndbQuery(
  endpoint: 'vn',
  body: Record<string, unknown>,
): Promise<VndbSearchResponse> {
  const response = await fetch(`${VNDB_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`VNDB API error: ${response.status}`);
  }

  return response.json();
}

export async function searchVndbGames(query: string, results = 10): Promise<VndbVN[]> {
  if (!query.trim()) return [];

  const data = await postVndbQuery('vn', {
    filters: ['search', '=', query.trim()],
    fields: 'id,title,aliases,released,developers{name},image{url,thumbnail},description,platforms,languages,tags{name,category},length_minutes',
    sort: 'searchrank',
    results,
  });

  return data.results ?? [];
}

export async function getVndbGame(id: string): Promise<VndbVN | null> {
  const vndbId = id.replace(/^vndb-/, '');
  if (!vndbId) return null;

  const data = await postVndbQuery('vn', {
    filters: ['id', '=', vndbId],
    fields: 'id,title,aliases,released,developers{name},image{url,thumbnail},screenshots{url},description,platforms,languages,tags{name,category,rating},length_minutes,extlinks{label,url},rating,votecount',
    sort: 'id',
    results: 1,
  });

  return data.results?.[0] ?? null;
}

export function getVndbCoverUrl(vn: VndbVN | null | undefined): string | null {
  return vn?.image?.url || null;
}
