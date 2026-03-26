import { NextRequest, NextResponse } from 'next/server';
import { getAnimeDetails, normalizeAnimeForApp, getAnimeStatusBadge, getAnimeFormatBadge, AniListAnime } from '@/lib/api/anilist';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      return NextResponse.json(
        { error: 'Invalid anime ID' },
        { status: 400 }
      );
    }

    console.log('Fetching anime details for ID:', numericId);
    
    const anime = await getAnimeDetails(numericId);
    
    console.log('AniList response:', anime ? 'Found' : 'Not found');
    console.log('Anime trailer data:', anime?.trailer);
    console.log('Has trailer:', !!anime?.trailer);
    console.log('Trailer site:', anime?.trailer?.site);

    if (!anime) {
      return NextResponse.json(
        { error: 'Anime not found' },
        { status: 404 }
      );
    }

    // Normalize the anime data
    const normalizedAnime = normalizeAnimeForApp(anime);

    // Build response matching exact raw API structure + frontend needs
    const details = {
      // Core fields from normalizeAnimeForApp
      ...normalizedAnime,
      
      // Include trailer for video player
      trailer: anime.trailer ? {
        id: anime.trailer.id,
        site: anime.trailer.site,
      } : null,
      
      // Formatted badges for display
      statusBadge: getAnimeStatusBadge(anime.status),
      formatBadge: getAnimeFormatBadge(anime.format),
      
      // Characters (top 10) - exact raw structure
      characters: anime.characters?.edges?.slice(0, 10).map((edge: { node: { id: number; name: { full: string }; image: { large: string | null; medium: string | null } }; role: string }) => ({
        id: edge.node.id,
        name: edge.node.name?.full || 'Unknown',
        role: edge.role,
        image: edge.node.image?.large || edge.node.image?.medium,
      })) || [],
      
      // Related anime - exact raw structure  
      relations: anime.relations?.edges?.map((edge: { node: { id: number; title: { romaji: string | null; english: string | null }; type: string; format: string; status: string; coverImage: { large: string | null; medium: string | null } }; relationType: string }) => ({
        id: edge.node.id,
        title: edge.node.title?.romaji || edge.node.title?.english || 'Unknown',
        type: edge.node.type,
        format: edge.node.format,
        status: edge.node.status,
        relationType: edge.relationType,
        coverImage: edge.node.coverImage?.large || edge.node.coverImage?.medium,
      })) || [],
      
      // Recommendations - exact raw structure
      recommendations: anime.recommendations?.nodes?.map((node: { mediaRecommendation: { id: number; title: { romaji: string | null; english: string | null }; coverImage: { large: string | null; medium: string | null } } }) => ({
        id: node.mediaRecommendation?.id,
        title: node.mediaRecommendation?.title?.romaji || node.mediaRecommendation?.title?.english || 'Unknown',
        coverImage: node.mediaRecommendation?.coverImage?.large || node.mediaRecommendation?.coverImage?.medium,
      })) || [],
    };

    return NextResponse.json(details);
  } catch (error) {
    console.error('Failed to fetch anime details from AniList:', error);
    return NextResponse.json(
      { error: 'Failed to fetch anime details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
