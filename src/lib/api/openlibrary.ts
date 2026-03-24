export interface OpenLibraryBook {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  subject?: string[];
  ratings_average?: number;
}

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryBook[];
}

export function getOpenLibraryCoverUrl(coverId: number | undefined, size: string = 'M'): string | null {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

export async function searchBooks(query: string, page: number = 1): Promise<OpenLibrarySearchResponse> {
  const limit = 20;
  const offset = (page - 1) * limit;
  
  const response = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to search books');
  }
  
  return response.json();
}

export async function getBookDetails(key: string): Promise<any> {
  const response = await fetch(
    `https://openlibrary.org${key}.json`,
    { next: { revalidate: 3600 } }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get book details');
  }
  
  return response.json();
}
