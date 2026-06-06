import { NextRequest, NextResponse } from 'next/server';
import { AniListManga, normalizeMangaForApp, searchManga } from '@/lib/api/anilist';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || 'manga';
  const page = Number.parseInt(searchParams.get('page') || '1', 10);

  try {
    const manga = (await searchManga(query, Number.isFinite(page) ? page : 1)) as AniListManga[];
    const results = manga.map(normalizeMangaForApp).map((item) => ({
      id: item.id,
      title: item.title,
      image: item.image,
      year: item.year,
      rating: item.rating,
      description: item.description,
      chapters: item.chapters,
      volumes: item.volumes,
      format: item.format,
      status: item.status,
      genres: item.genres,
    }));

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Manga API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch manga' }, { status: 500 });
  }
}
