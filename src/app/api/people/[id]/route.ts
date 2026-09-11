import { NextRequest, NextResponse } from 'next/server';

interface TmdbPersonCreditCast {
  id: number;
  media_type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  character?: string;
  characters?: string[];
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  popularity?: number;
}

interface TmdbPersonCreditCrew {
  id: number;
  media_type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  department?: string;
  job?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  popularity?: number;
}

interface TmdbPersonDetail {
  id: number;
  name: string;
  also_known_as?: string[];
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  gender?: number;
  homepage?: string | null;
  known_for_department?: string;
  place_of_birth?: string | null;
  popularity?: number;
  profile_path?: string | null;
  images?: { profiles?: { file_path: string; width?: number; height?: number }[] };
  external_ids?: {
    imdb_id?: string | null;
    wikidata_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
  };
  combined_credits?: {
    cast?: TmdbPersonCreditCast[];
    crew?: TmdbPersonCreditCrew[];
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const numericMatch = idParam.match(/(\d+)$/);
  const id = numericMatch ? numericMatch[1] : idParam;

  if (!id || isNaN(parseInt(id))) {
    return NextResponse.json({ error: 'Invalid person ID' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/person/${id}?api_key=${process.env.TMDB_API_KEY}&append_to_response=combined_credits,external_ids,images`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch person details');
    }

    const person = (await response.json()) as TmdbPersonDetail;

    const cast = (person.combined_credits?.cast || [])
      .map((c) => ({
        id: c.id,
        mediaType: c.media_type === 'tv' ? 'tv' : 'movie',
        title: c.title || c.name || '',
        character: c.characters?.join(', ') || c.character || '',
        poster_path: c.poster_path || null,
        date: c.release_date || c.first_air_date || null,
        popularity: c.popularity || 0,
      }))
      .sort((a, b) => b.popularity - a.popularity);

    const crew = (person.combined_credits?.crew || [])
      .map((c) => ({
        id: c.id,
        mediaType: c.media_type === 'tv' ? 'tv' : 'movie',
        title: c.title || c.name || '',
        department: c.department || 'Other',
        job: c.job || '',
        poster_path: c.poster_path || null,
        date: c.release_date || c.first_air_date || null,
        popularity: c.popularity || 0,
      }))
      .sort((a, b) => b.popularity - a.popularity);

    return NextResponse.json({
      id: person.id,
      name: person.name,
      also_known_as: person.also_known_as || [],
      biography: person.biography || '',
      birthday: person.birthday || null,
      deathday: person.deathday || null,
      place_of_birth: person.place_of_birth || null,
      known_for_department: person.known_for_department || '',
      profile_path: person.profile_path || null,
      popularity: person.popularity || 0,
      homepage: person.homepage || null,
      external_ids: {
        imdb_id: person.external_ids?.imdb_id || null,
        wikidata_id: person.external_ids?.wikidata_id || null,
        facebook_id: person.external_ids?.facebook_id || null,
        instagram_id: person.external_ids?.instagram_id || null,
        twitter_id: person.external_ids?.twitter_id || null,
      },
      images: (person.images?.profiles || []).slice(0, 12),
      credits: { cast, crew },
    });
  } catch {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }
}
