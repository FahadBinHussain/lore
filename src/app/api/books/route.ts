import { NextRequest, NextResponse } from 'next/server';
import { searchBooks, getOpenLibraryCoverUrl } from '@/lib/api/openlibrary';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');

  try {
    let books;

    if (query) {
      // Search for books
      books = await searchBooks(query, page);
    } else {
      // Get popular/trending books (default search for fiction books)
      books = await searchBooks('subject:fiction', page);
    }

    const results = books.docs.map(b => ({
      id: b.key,
      title: b.title,
      image: getOpenLibraryCoverUrl(b.cover_i),
      year: b.first_publish_year?.toString(),
      rating: b.ratings_average,
      description: b.subject?.slice(0, 3).join(', '),
      author: b.author_name?.[0],
      pages: b.number_of_pages_median,
      isbn: b.isbn?.[0],
    }));

    return NextResponse.json({
      results,
      page,
      totalPages: Math.ceil(books.numFound / 20),
      totalResults: books.numFound,
    });
  } catch (error) {
    console.error('Books API error:', error);
    return NextResponse.json({ results: [], error: 'Failed to fetch books' }, { status: 500 });
  }
}