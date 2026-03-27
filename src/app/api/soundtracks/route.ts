import { NextRequest, NextResponse } from 'next/server';
import { searchRecordings, formatDuration, MusicBrainzRecording } from '@/lib/api/musicbrainz';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || 'soundtrack';
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    console.log('Fetching soundtracks with query:', query, 'limit:', limit);
    
    // Search MusicBrainz for soundtrack recordings
    const recordings = await searchRecordings(query, limit);
    
    console.log('Found recordings:', recordings.length);

    const results = recordings.map((r: MusicBrainzRecording) => ({
      id: r.id,
      title: r.title,
      artist: r['artist-credit']?.[0]?.artist?.name || 'Unknown Artist',
      duration: formatDuration(r.length),
      year: r.releases?.[0]?.date?.split('-')[0],
      album: r.releases?.[0]?.title,
      genres: r.tags?.slice(0, 3).map((t: any) => t.name).join(', '),
    }));

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Soundtracks API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch soundtracks' }, { status: 500 });
  }
}