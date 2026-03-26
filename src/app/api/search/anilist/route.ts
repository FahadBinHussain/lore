import { NextResponse } from 'next/server';

const ANILIST_API_URL = 'https://graphql.anilist.co';

const SEARCH_ANIME_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 5) {
      media(type: ANIME, search: $search, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        type
        format
        status
        coverImage {
          large
          medium
        }
        averageScore
        seasonYear
      }
    }
  }
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_ANIME_QUERY,
        variables: { search: query },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to search AniList');
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('AniList API errors:', data.errors);
      return NextResponse.json({ results: [] }, { status: 500 });
    }

    const results = data.data?.Page?.media || [];
    
    // Return results with the site's anime page URL format
    return NextResponse.json({ 
      results: results.map((anime: any) => ({
        id: anime.id,
        title: anime.title.romaji || anime.title.english || anime.title.native,
        englishTitle: anime.title.english,
        nativeTitle: anime.title.native,
        type: anime.type,
        format: anime.format,
        status: anime.status,
        coverImage: anime.coverImage?.large || anime.coverImage?.medium,
        averageScore: anime.averageScore,
        seasonYear: anime.seasonYear,
        // Site anime page URL
        siteUrl: `/anime/${anime.id}`,
        // Direct AniList URL
        anilistUrl: `https://anilist.co/anime/${anime.id}`,
      }))
    });
  } catch (error) {
    console.error('Failed to search AniList:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
