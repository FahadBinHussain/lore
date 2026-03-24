import { NextRequest, NextResponse } from 'next/server';
import { searchMovies, searchTVShows, getTMDBImageUrl } from '@/lib/api/tmdb';
import { searchBooks, getOpenLibraryCoverUrl } from '@/lib/api/openlibrary';
import { searchGames, getIGDBAccessToken, getIGDBCoverUrl } from '@/lib/api/igdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all';

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results: any[] = [];

  try {
    // Search movies
    if (type === 'all' || type === 'movie') {
      const movies = await searchMovies(query);
      results.push(...movies.results.map(m => ({
        id: `movie-${m.id}`,
        title: m.title,
        type: 'movie',
        image: getTMDBImageUrl(m.poster_path),
        year: m.release_date?.split('-')[0],
        rating: m.vote_average,
        description: m.overview,
      })));
    }

    // Search TV shows
    if (type === 'all' || type === 'tv') {
      const shows = await searchTVShows(query);
      results.push(...shows.results.map(s => ({
        id: `tv-${s.id}`,
        title: s.name,
        type: 'tv',
        image: getTMDBImageUrl(s.poster_path),
        year: s.first_air_date?.split('-')[0],
        rating: s.vote_average,
        description: s.overview,
      })));
    }

    // Search books
    if (type === 'all' || type === 'book') {
      const books = await searchBooks(query);
      results.push(...books.docs.slice(0, 20).map(b => ({
        id: `book-${b.key}`,
        title: b.title,
        type: 'book',
        image: getOpenLibraryCoverUrl(b.cover_i),
        year: b.first_publish_year?.toString(),
        rating: b.ratings_average,
        author: b.author_name?.[0],
      })));
    }

    // Search games
    if (type === 'all' || type === 'game') {
      try {
        const accessToken = await getIGDBAccessToken();
        const games = await searchGames(query, accessToken);
        results.push(...games.map(g => ({
          id: `game-${g.id}`,
          title: g.name,
          type: 'game',
          image: getIGDBCoverUrl(g.cover?.url),
          year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear().toString() : undefined,
          rating: g.rating ? g.rating / 10 : undefined,
          description: g.summary,
        })));
      } catch (error) {
        console.error('IGDB search error:', error);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 });
  }
}
