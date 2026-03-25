import { NextRequest, NextResponse } from 'next/server';
import { getBookDetails } from '@/lib/api/openlibrary';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string[] }> }
) {
  const { id: idArray } = await params;
  const idParam = '/' + idArray.join('/');

  try {
    // Fetch book details from Open Library
    const fullKey = idParam.startsWith('/') ? idParam : `/${idParam}`;
    const book = await getBookDetails(fullKey);

    // Fetch author names and details for the authors array
    const authorsWithNames = [];
    if (book.authors && Array.isArray(book.authors)) {
      for (const authorRef of book.authors.slice(0, 10)) {
        try {
          const authorKey = authorRef.author?.key || authorRef.key;
          if (authorKey) {
            const authorResponse = await fetch(
              `https://openlibrary.org${authorKey}.json`,
              { next: { revalidate: 3600 } }
            );
            if (authorResponse.ok) {
              const authorData = await authorResponse.json();
              authorsWithNames.push({
                key: authorKey,
                name: authorData.name || authorKey.split('/').pop(),
                bio: authorData.bio?.value || authorData.bio || null,
                birth_date: authorData.birth_date || null,
                death_date: authorData.death_date || null,
                photos: authorData.photos || [],
              });
            }
          }
        } catch (err) {
          console.error('Failed to fetch author:', err);
          const authorKey = authorRef.author?.key || authorRef.key;
          if (authorKey) {
            authorsWithNames.push({
              key: authorKey,
              name: authorKey.split('/').pop(),
            });
          }
        }
      }
    }

    // Fetch ratings
    let ratings = null;
    try {
      const ratingsResponse = await fetch(
        `https://openlibrary.org${fullKey}/ratings.json`,
        { next: { revalidate: 3600 } }
      );
      if (ratingsResponse.ok) {
        ratings = await ratingsResponse.json();
      }
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
    }

    // Fetch reading log stats
    let readingLog = null;
    try {
      const readingLogResponse = await fetch(
        `https://openlibrary.org${fullKey}/bookshelves.json`,
        { next: { revalidate: 3600 } }
      );
      if (readingLogResponse.ok) {
        readingLog = await readingLogResponse.json();
      }
    } catch (err) {
      console.error('Failed to fetch reading log:', err);
    }

    // Fetch editions count
    let editionsCount = 0;
    try {
      const editionsResponse = await fetch(
        `https://openlibrary.org${fullKey}/editions.json?limit=1`,
        { next: { revalidate: 3600 } }
      );
      if (editionsResponse.ok) {
        const editionsData = await editionsResponse.json();
        editionsCount = editionsData.size || 0;
      }
    } catch (err) {
      console.error('Failed to fetch editions:', err);
    }

    // Fetch first sentence from work
    let firstSentenceData = null;
    try {
      if (book.works && book.works.length > 0) {
        const workResponse = await fetch(
          `https://openlibrary.org${book.works[0].key}.json`,
          { next: { revalidate: 3600 } }
        );
        if (workResponse.ok) {
          const workData = await workResponse.json();
          firstSentenceData = workData.first_sentence?.value || workData.first_sentence || null;
        }
      }
    } catch (err) {
      console.error('Failed to fetch first sentence:', err);
    }

    // Fetch similar books
    let similarBooks: any[] = [];
    if (book.subjects && book.subjects.length > 0) {
      try {
        const subjectQuery = book.subjects[0].replace(/\s+/g, '_');
        const similarResponse = await fetch(
          `https://openlibrary.org/subjects/${subjectQuery.toLowerCase()}.json?limit=6`,
          { next: { revalidate: 3600 } }
        );
        if (similarResponse.ok) {
          const similarData = await similarResponse.json();
          similarBooks = (similarData.works || []).slice(0, 6).map((w: any) => ({
            key: w.key,
            title: w.title,
            cover_id: w.cover_id,
            authors: w.authors?.map((a: any) => a.name).join(', '),
            first_publish_year: w.first_publish_year,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch similar books:', err);
      }
    }

    // Fetch links
    let links: any[] = [];
    try {
      if (book.works && book.works.length > 0) {
        const linksResponse = await fetch(
          `https://openlibrary.org${book.works[0].key}/links.json`,
          { next: { revalidate: 3600 } }
        );
        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          links = linksData.links || [];
        }
      }
    } catch (err) {
      console.error('Failed to fetch links:', err);
    }

    // Fetch excerpts
    let excerpts: any[] = [];
    try {
      if (book.works && book.works.length > 0) {
        const excerptsResponse = await fetch(
          `https://openlibrary.org${book.works[0].key}/excerpts.json`,
          { next: { revalidate: 3600 } }
        );
        if (excerptsResponse.ok) {
          const excerptsData = await excerptsResponse.json();
          excerpts = excerptsData.excerpts || [];
        }
      }
    } catch (err) {
      console.error('Failed to fetch excerpts:', err);
    }

    // Return the raw response with all additional fetched data
    return NextResponse.json({
      ...book,
      author_names: authorsWithNames,
      ratings,
      reading_log: readingLog,
      editions_count: editionsCount,
      first_sentence: firstSentenceData,
      similar_books: similarBooks,
      links,
      excerpts,
    });
  } catch (error) {
    console.error('Book detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch book details' }, { status: 500 });
  }
}
