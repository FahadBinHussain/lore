import { NextResponse } from 'next/server';
import { getAttractionDetails } from '@/lib/api/themeparks';
import { getProviderSourceUrl } from '@/lib/media/provider-registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const attraction = await getAttractionDetails(id);
    if (!attraction) {
      return NextResponse.json({ error: 'Theme park attraction not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: attraction.id,
      title: attraction.name,
      mediaType: 'themepark',
      source: 'themeparks',
      image: null,
      description: attraction.description || null,
      releaseDate: null,
      subtitle: attraction.parkName,
      externalUrl: getProviderSourceUrl('themeparks', 'themepark', attraction.id),
      fields: [
        { label: 'Park', value: attraction.parkName },
        { label: 'Status', value: attraction.status },
        { label: 'Wait time', value: typeof attraction.waitTime === 'number' ? `${attraction.waitTime} min` : null },
        { label: 'Last update', value: attraction.lastUpdate },
      ],
    });
  } catch (error) {
    console.error('Theme park detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch theme park details' }, { status: 500 });
  }
}
