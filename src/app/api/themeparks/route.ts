import { NextRequest, NextResponse } from 'next/server';
import { searchAttractions, getThemeParks } from '@/lib/api/themeparks';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  try {
    let attractions;

    if (query) {
      // Search for attractions
      attractions = await searchAttractions(query);
    } else {
      // Get attractions from popular parks (default)
      const parks = await getThemeParks();
      attractions = [];

      // Get attractions from first few parks
      for (const park of parks.slice(0, 3)) {
        try {
          const parkAttractions = await import('@/lib/api/themeparks').then(m => m.getParkAttractions(park.id));
          attractions.push(...parkAttractions.slice(0, 10)); // Limit per park
        } catch (error) {
          console.warn(`Failed to fetch attractions for park ${park.id}:`, error);
        }
      }
    }

    const results = attractions.map(attraction => ({
      id: attraction.id,
      title: attraction.name,
      image: null, // Themeparks.wiki doesn't provide images
      location: attraction.parkName,
      description: attraction.description,
      waitTime: attraction.waitTime,
      status: attraction.status,
      latitude: attraction.location?.latitude,
      longitude: attraction.location?.longitude,
    }));

    return NextResponse.json({
      results,
      totalResults: results.length,
    });
  } catch (error) {
    console.error('Themeparks API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch theme park attractions' }, { status: 500 });
  }
}