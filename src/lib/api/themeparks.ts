export interface ThemeParkAttraction {
  id: string;
  name: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  description?: string;
  parkId: string;
  parkName: string;
  waitTime?: number;
  status?: string;
  lastUpdate?: string;
}

export interface ThemePark {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  timezone: string;
  attractions: ThemeParkAttraction[];
}

export interface ThemeparksWikiResponse {
  parks: ThemePark[];
}

// Note: Themeparks.wiki doesn't require an API key for basic access
export async function getThemeParks(): Promise<ThemePark[]> {
  // This would typically fetch from themeparks.wiki API
  // For now, returning mock data since the actual API structure may vary
  const response = await fetch('https://api.themeparks.wiki/v1/parks', {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch theme parks');
  }

  const data = await response.json();
  return data.parks || [];
}

export async function getParkAttractions(parkId: string): Promise<ThemeParkAttraction[]> {
  const response = await fetch(`https://api.themeparks.wiki/v1/parks/${parkId}/attractions`, {
    next: { revalidate: 300 }, // Shorter cache for wait times
  });

  if (!response.ok) {
    throw new Error('Failed to fetch park attractions');
  }

  const data = await response.json();
  return data.attractions || [];
}

export async function searchAttractions(query: string): Promise<ThemeParkAttraction[]> {
  // Search across all parks for attractions matching the query
  try {
    const parks = await getThemeParks();
    const allAttractions: ThemeParkAttraction[] = [];

    for (const park of parks.slice(0, 5)) { // Limit to first 5 parks for performance
      try {
        const attractions = await getParkAttractions(park.id);
        allAttractions.push(...attractions);
      } catch (error) {
        console.warn(`Failed to fetch attractions for park ${park.id}:`, error);
      }
    }

    // Filter attractions by query
    return allAttractions.filter(attraction =>
      attraction.name.toLowerCase().includes(query.toLowerCase()) ||
      attraction.parkName.toLowerCase().includes(query.toLowerCase())
    );
  } catch (error) {
    console.error('Failed to search attractions:', error);
    return [];
  }
}