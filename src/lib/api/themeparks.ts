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

export interface DestinationEntry {
  id: string;
  name: string;
  slug: string;
  parks: Array<{
    id: string;
    name: string;
  }>;
}

export interface DestinationsResponse {
  destinations: DestinationEntry[];
}

export interface EntityChild {
  id: string;
  name: string;
  entityType: string;
  externalId?: string;
  parentId?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface EntityChildrenResponse {
  id: string;
  name: string;
  entityType: string;
  timezone: string;
  children: EntityChild[];
}

export interface LiveQueue {
  STANDBY?: {
    waitTime: number;
  };
  SINGLE_RIDER?: {
    waitTime: number | null;
  };
  RETURN_TIME?: {
    state: string;
    returnStart: string | null;
    returnEnd: string | null;
  };
  PAID_RETURN_TIME?: {
    state: string;
    returnStart: string | null;
    returnEnd: string | null;
    price?: any;
  };
  BOARDING_GROUP?: {
    allocationStatus: string;
    currentGroupStart: number | null;
    currentGroupEnd: number | null;
    nextAllocationTime: string | null;
    estimatedWait: number | null;
  };
  PAID_STANDBY?: {
    waitTime: number | null;
  };
}

export interface LiveData {
  id: string;
  name: string;
  entityType: string;
  status: string;
  lastUpdated: string;
  queue?: LiveQueue;
  showtimes?: any[];
  operatingHours?: any[];
  diningAvailability?: any[];
}

export interface EntityLiveDataResponse {
  id: string;
  name: string;
  entityType: string;
  timezone: string;
  liveData: LiveData[];
}

// Note: Themeparks.wiki doesn't require an API key for basic access
export async function getThemeParks(): Promise<ThemePark[]> {
  const response = await fetch('https://api.themeparks.wiki/v1/destinations', {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch theme parks');
  }

  const data: DestinationsResponse = await response.json();

  // Convert destinations to ThemePark format for compatibility
  const parks: ThemePark[] = [];
  for (const dest of data.destinations) {
    for (const park of dest.parks) {
      parks.push({
        id: park.id,
        name: park.name,
        location: {
          latitude: 0, // Will be populated from entity data if needed
          longitude: 0,
          country: dest.name,
        },
        timezone: 'UTC', // Default, will be updated from entity data
        attractions: [], // Will be populated when requested
      });
    }
  }

  return parks;
}

export async function getParkAttractions(parkId: string): Promise<ThemeParkAttraction[]> {
  try {
    // First get the children (attractions) of the park
    const childrenResponse = await fetch(`https://api.themeparks.wiki/v1/entity/${parkId}/children`, {
      next: { revalidate: 300 },
    });

    if (!childrenResponse.ok) {
      throw new Error('Failed to fetch park attractions');
    }

    const childrenData: EntityChildrenResponse = await childrenResponse.json();

    // Filter for ATTRACTION entities
    const attractionEntities = childrenData.children.filter(
      child => child.entityType === 'ATTRACTION'
    );

    // Get live data for wait times
    const liveResponse = await fetch(`https://api.themeparks.wiki/v1/entity/${parkId}/live`, {
      next: { revalidate: 300 },
    });

    const liveData: EntityLiveDataResponse = liveResponse.ok ? await liveResponse.json() : { liveData: [] };

    // Create live data map for quick lookup
    const liveDataMap = new Map<string, LiveData>();
    liveData.liveData.forEach(item => {
      liveDataMap.set(item.id, item);
    });

    // Convert to our ThemeParkAttraction format
    const attractions: ThemeParkAttraction[] = attractionEntities.map(entity => {
      const liveInfo = liveDataMap.get(entity.id);

      return {
        id: entity.id,
        name: entity.name,
        location: entity.location ? {
          latitude: entity.location.latitude || 0,
          longitude: entity.location.longitude || 0,
        } : undefined,
        parkId: parkId,
        parkName: childrenData.name,
        waitTime: liveInfo?.queue?.STANDBY?.waitTime,
        status: liveInfo?.status || 'Unknown',
        lastUpdate: liveInfo?.lastUpdated,
      };
    });

    return attractions;
  } catch (error) {
    console.error('Error fetching park attractions:', error);
    return [];
  }
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