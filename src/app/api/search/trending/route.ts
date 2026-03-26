import { NextResponse } from 'next/server';
import { getTrendingMovies, getTrendingTVShows, getTMDBImageUrl } from '@/lib/api/tmdb';

export async function GET() {
  try {
    const [moviesResponse, tvResponse] = await Promise.all([
      getTrendingMovies('week', 1),
      getTrendingTVShows('week', 1),
    ]);

    const trendingItems = [
      ...moviesResponse.results.slice(0, 6).map((movie) => ({
        id: movie.id.toString(),
        title: movie.title,
        type: 'movie' as const,
        image: getTMDBImageUrl(movie.poster_path, 'w342'),
        year: movie.release_date ? movie.release_date.split('-')[0] : '',
        rating: Math.round(movie.vote_average * 10) / 10,
        genre: movie.genre_ids?.[0] ? movie.genre_ids[0].toString() : '',
      })),
      ...tvResponse.results.slice(0, 6).map((show) => ({
        id: show.id.toString(),
        title: show.name,
        type: 'tv' as const,
        image: getTMDBImageUrl(show.poster_path, 'w342'),
        year: show.first_air_date ? show.first_air_date.split('-')[0] : '',
        rating: Math.round(show.vote_average * 10) / 10,
        genre: show.genre_ids?.[0] ? show.genre_ids[0].toString() : '',
      })),
    ];

    // Shuffle to mix movies and TV shows
    const shuffled = trendingItems.sort(() => Math.random() - 0.5);

    return NextResponse.json({ results: shuffled });
  } catch (error) {
    console.error('Failed to fetch trending:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
