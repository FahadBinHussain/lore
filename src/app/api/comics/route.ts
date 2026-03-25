import { NextRequest, NextResponse } from 'next/server';
import { searchComics, getComicVineImageUrl } from '@/lib/api/comicvine';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');

  try {
    let comics;

    if (query) {
      comics = await searchComics(query, page);
    } else {
      // For now, return empty array when no query
      comics = { results: [], number_of_total_results: 0 };
    }

    const results = comics.results.map(c => ({
      id: c.id,
      title: c.name,
      image: getComicVineImageUrl(c.image),
      year: c.cover_date ? new Date(c.cover_date).getFullYear().toString() : undefined,
      issue: c.issue_number,
      volume: c.volume?.name,
      description: c.description,
      creators: c.person_credits?.slice(0, 3).map(p => p.name).join(', '),
    }));

    return NextResponse.json({
      results,
      page,
      totalPages: Math.ceil(comics.number_of_total_results / 20),
      totalResults: comics.number_of_total_results,
    });
  } catch (error) {
    console.error('Comics API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch comics' }, { status: 500 });
  }
}