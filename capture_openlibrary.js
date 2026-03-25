const fs = require('fs');
const path = require('path');

async function captureOpenLibraryResponse() {
  // Use a popular book key from OpenLibrary
  const bookKey = '/works/OL45804W'; // 1984 by George Orwell

  try {
    console.log('Fetching raw OpenLibrary response for book key:', bookKey);

    const response = await fetch(
      `https://openlibrary.org${bookKey}.json`
    );

    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status} - ${response.statusText}`);
    }

    const rawData = await response.json();

    // Save to JSON file
    const outputPath = path.join(__dirname, 'raw_openlibrary_response.json');
    fs.writeFileSync(outputPath, JSON.stringify(rawData, null, 2));

    console.log('✅ Raw OpenLibrary response saved to:', outputPath);
    console.log('Fields in response:', Object.keys(rawData).sort().join(', '));
    console.log('Total fields:', Object.keys(rawData).length);

  } catch (error) {
    console.error('Error capturing OpenLibrary response:', error);
    process.exit(1);
  }
}

captureOpenLibraryResponse();