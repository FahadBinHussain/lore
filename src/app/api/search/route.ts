import { NextRequest, NextResponse } from 'next/server';
import { searchMovies, searchTVShows, getTMDBImageUrl } from '@/lib/api/tmdb';
import { searchBooks, getOpenLibraryCoverUrl } from '@/lib/api/openlibrary';
import { searchGames, getIGDBAccessToken, getIGDBCoverUrl } from '@/lib/api/igdb';
import { searchBoardGames } from '@/lib/api/bgg';
import { searchComics } from '@/lib/api/comicvine';
import { searchPodcasts } from '@/lib/api/listennotes';
import { searchRecordings } from '@/lib/api/musicbrainz';
import { searchAttractions } from '@/lib/api/themeparks';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const results: any[] = [];

  try {
    // Search movies (if type is not specified or includes movie)
    if (!type || type === 'movie') {
      try {
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
      } catch (error) {
        console.error('TMDB movies search error:', error);
      }
    }

    // Search TV shows (if type is not specified or includes tv)
    if (!type || type === 'tv') {
      try {
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
      } catch (error) {
        console.error('TMDB TV search error:', error);
      }
    }

    // Search books (if type is not specified)
    if (!type) {
      try {
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
      } catch (error) {
        console.error('OpenLibrary search error:', error);
      }
    }

    // Search games (if type is not specified)
    if (!type) {
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
    }    // Search board games (if type is not specified)
    if (!type) {
      try {
        const boardGames = await searchBoardGames(query);
        results.push(...boardGames.slice(0, 20).map(g => ({
          id: `boardgame-${g.id}`,
          title: g.name,
          type: 'boardgame',
          image: g.image_url,
          year: g.year_published?.toString(),
          description: g.description,
        })));
      } catch (error) {
        console.error('BGG search error:', error);
      }
    }

    // Search comics (if type is not specified)
    if (!type) {
      try {
        const comics = await searchComics(query);
        results.push(...comics.results.slice(0, 20).map(c => ({
          id: `comic-${c.id}`,
          title: c.name,
          type: 'comic',
          image: c.image?.original_url,
          year: c.cover_date?.split('-')[0],
          description: c.description,
        })));
      } catch (error) {
        console.error('ComicVine search error:', error);
      }
    }

    // Search podcasts (if type is not specified)
    if (!type) {
      try {
        const podcasts = await searchPodcasts(query);
        results.push(...podcasts.results.slice(0, 20).map(p => ({
          id: `podcast-${p.id}`,
          title: p.title,
          type: 'podcast',
          image: p.image,
          description: p.description,
        })));
      } catch (error) {
        console.error('ListenNotes search error:', error);
      }
    }

    // Search soundtracks (if type is not specified)
    if (!type) {
      try {
        const recordings = await searchRecordings(query);
        results.push(...recordings.slice(0, 20).map(r => ({
          id: `soundtrack-${r.id}`,
          title: r.title,
          type: 'soundtrack',
          year: r.releases?.[0]?.date?.split('-')[0],
          description: r.tags?.[0]?.name,
        })));
      } catch (error) {
        console.error('MusicBrainz search error:', error);
      }
    }

    // Search theme park attractions (if type is not specified)
    if (!type) {
      try {
        const attractions = await searchAttractions(query);
        results.push(...attractions.slice(0, 20).map(a => ({
          id: `themepark-${a.id}`,
          title: a.name,
          type: 'themepark',
          description: a.description,
        })));
      } catch (error) {
        console.error('ThemeParks search error:', error);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 500 });
  }
}
