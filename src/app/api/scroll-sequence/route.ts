import { readdir } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCROLL_SEQUENCE_DIR = path.join(process.cwd(), 'public', 'scroll sequence');
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|avif)$/i;

function getSequenceNumber(filename: string): number {
  const numberMatches = filename.match(/\d+/g);
  if (!numberMatches || numberMatches.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Number.parseInt(numberMatches[numberMatches.length - 1], 10);
}

export async function GET() {
  try {
    const entries = await readdir(SCROLL_SEQUENCE_DIR, { withFileTypes: true });

    const orderedFrameNames = entries
      .filter((entry) => entry.isFile() && IMAGE_FILE_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => {
        const sequenceDiff = getSequenceNumber(a) - getSequenceNumber(b);
        if (sequenceDiff !== 0) {
          return sequenceDiff;
        }

        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

    const folderSegment = encodeURIComponent('scroll sequence');
    const frames = orderedFrameNames.map(
      (name) => `/${folderSegment}/${encodeURIComponent(name)}`
    );

    return NextResponse.json({ frames });
  } catch (error) {
    console.error('Failed to read scroll-sequence frames:', error);
    return NextResponse.json({ frames: [] }, { status: 500 });
  }
}
