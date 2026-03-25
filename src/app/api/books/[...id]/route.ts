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

    // Process cover URL
    const coverUrl = book.covers && book.covers.length > 0
      ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-L.jpg`
      : null;

    // Get authors with details
    const authors = [];
    if (book.authors) {
      for (const authorRef of book.authors.slice(0, 5)) {
        try {
          const authorResponse = await fetch(
            `https://openlibrary.org${authorRef.author.key}.json`,
            { next: { revalidate: 3600 } }
          );
          if (authorResponse.ok) {
            const authorData = await authorResponse.json();
            authors.push({
              key: authorRef.author.key,
              name: authorData.name,
              bio: authorData.bio?.value || authorData.bio || null,
              birth_date: authorData.birth_date,
              death_date: authorData.death_date,
              photo: authorData.photos?.[0]
                ? `https://covers.openlibrary.org/b/id/${authorData.photos[0]}-M.jpg`
                : null,
            });
          }
        } catch (err) {
          console.error('Failed to fetch author:', err);
        }
      }
    }

    // Get subjects/genres
    const subjects = book.subjects || [];
    const subjectPlaces = book.subject_places || [];
    const subjectPeople = book.subject_people || [];
    const subjectTimes = book.subject_times || [];

    // Get work details if available
    let workDetails = null;
    if (book.works && book.works.length > 0) {
      try {
        const workResponse = await fetch(
          `https://openlibrary.org${book.works[0].key}.json`,
          { next: { revalidate: 3600 } }
        );
        if (workResponse.ok) {
          workDetails = await workResponse.json();
        }
      } catch (err) {
        console.error('Failed to fetch work details:', err);
      }
    }

    // Get editions count
    let editionsCount = 0;
    try {
      const editionsResponse = await fetch(
        `https://openlibrary.org${idParam}/editions.json?limit=1`,
        { next: { revalidate: 3600 } }
      );
      if (editionsResponse.ok) {
        const editionsData = await editionsResponse.json();
        editionsCount = editionsData.size || 0;
      }
    } catch (err) {
      console.error('Failed to fetch editions count:', err);
    }

    // Get ratings
    let ratings = null;
    try {
      const ratingsResponse = await fetch(
        `https://openlibrary.org${idParam}/ratings.json`,
        { next: { revalidate: 3600 } }
      );
      if (ratingsResponse.ok) {
        ratings = await ratingsResponse.json();
      }
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
    }

    // Get reading log stats
    let readingLog = null;
    try {
      const readingLogResponse = await fetch(
        `https://openlibrary.org${idParam}/bookshelves.json`,
        { next: { revalidate: 3600 } }
      );
      if (readingLogResponse.ok) {
        readingLog = await readingLogResponse.json();
      }
    } catch (err) {
      console.error('Failed to fetch reading log:', err);
    }

    // Get first sentence
    const firstSentence = book.first_sentence?.value || book.first_sentence || null;

    // Get description
    const description = book.description?.value || book.description || null;

    // Get links
    const links = book.links || [];

    // Get excerpts
    const excerpts = book.excerpts || [];

    // Get table of contents
    const tableOfContents = book.table_of_contents || [];

    // Get publishers from editions
    const publishers = [];
    if (book.publishers) {
      publishers.push(...book.publishers.slice(0, 5));
    }

    // Get ISBNs
    const isbns = [];
    if (book.isbn_10) isbns.push(...book.isbn_10);
    if (book.isbn_13) isbns.push(...book.isbn_13);

    // Get languages
    const languages = book.languages?.map((l: any) => l.key?.replace('/languages/', '')) || [];

    // Get edition info
    const editionInfo = {
      physical_format: book.physical_format || null,
      pagination: book.pagination || null,
      number_of_pages: book.number_of_pages || null,
      weight: book.weight || null,
      publish_date: book.publish_date || null,
      publishers: publishers,
      isbn_10: book.isbn_10 || [],
      isbn_13: book.isbn_13 || [],
      lccn: book.lccn || [],
      oclc: book.oclc || [],
    };

    // Process similar books (from subjects)
    const similarBooks = [];
    if (subjects.length > 0) {
      try {
        const subjectQuery = subjects[0].replace(/\s+/g, '_');
        const similarResponse = await fetch(
          `https://openlibrary.org/subjects/${subjectQuery.toLowerCase()}.json?limit=6`,
          { next: { revalidate: 3600 } }
        );
        if (similarResponse.ok) {
          const similarData = await similarResponse.json();
          similarBooks.push(...(similarData.works || []).slice(0, 6).map((w: any) => ({
            key: w.key,
            title: w.title,
            cover_id: w.cover_id,
            authors: w.authors?.map((a: any) => a.name).join(', '),
            first_publish_year: w.first_publish_year,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch similar books:', err);
      }
    }

    const result = {
      key: book.key,
      title: book.title,
      subtitle: book.subtitle || null,
      description: description,
      first_sentence: firstSentence,
      cover_url: coverUrl,
      authors: authors,
      subjects: subjects.slice(0, 20),
      subject_places: subjectPlaces.slice(0, 10),
      subject_people: subjectPeople.slice(0, 10),
      subject_times: subjectTimes.slice(0, 10),
      first_publish_date: book.first_publish_date || null,
      edition_info: editionInfo,
      editions_count: editionsCount,
      ratings: ratings,
      reading_log: readingLog,
      links: links.slice(0, 10),
      excerpts: excerpts.slice(0, 5),
      table_of_contents: tableOfContents.slice(0, 15),
      languages: languages,
      similar_books: similarBooks,
      work_details: workDetails ? {
        description: workDetails.description?.value || workDetails.description || null,
        subjects: workDetails.subjects || [],
        subject_places: workDetails.subject_places || [],
        subject_people: workDetails.subject_people || [],
        subject_times: workDetails.subject_times || [],
        first_sentence: workDetails.first_sentence?.value || workDetails.first_sentence || null,
      } : null,
      created: book.created,
      last_modified: book.last_modified,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Book detail API error:', error);
    return NextResponse.json({ error: 'Failed to fetch book details' }, { status: 500 });
  }
}