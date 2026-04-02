import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { collections, collectionItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { slugify } from '@/lib/utils';
import { isAdminRole } from '@/lib/auth/roles';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (!isAdminRole(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const selectedItems = formData.get('selectedItems') as string;
    const coverImage = formData.get('coverImage') as File | null;
    const bannerImage = formData.get('bannerImage') as File | null;

    let parsedSelectedItems: Array<{id: number, title: string, type: string, image?: string}> = [];
    if (selectedItems) {
      try {
        parsedSelectedItems = JSON.parse(selectedItems);
      } catch (error) {
        console.error('Failed to parse selected items:', error);
      }
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Universe name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    // Check for slug uniqueness
    while (true) {
      const existing = await db.query.collections.findFirst({
        where: eq(collections.slug, slug),
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Handle image uploads (simplified - in production you'd upload to cloud storage)
    let coverImageUrl = null;
    let bannerImageUrl = null;

    // For now, we'll skip actual file uploads and just store null
    // In a real implementation, you'd upload files to a cloud storage service

    // Create the universe
    const [newUniverse] = await db.insert(collections).values({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      coverImage: coverImageUrl,
      bannerImage: bannerImageUrl,
      createdBy: parseInt(session.user.id!),
      visibility: 'public',
      isFeatured: false,
      viewCount: 0,
      itemCount: parsedSelectedItems.length,
      followerCount: 0,
    }).returning();

    // Add selected items to the collection
    if (parsedSelectedItems.length > 0) {
      const collectionItemsData = parsedSelectedItems.map((item, index) => ({
        collectionId: newUniverse.id,
        mediaItemId: item.id,
        orderIndex: index,
        isRequired: true,
        notes: null,
      }));

      await db.insert(collectionItems).values(collectionItemsData);
    }

    return NextResponse.json({
      id: newUniverse.id,
      name: newUniverse.name,
      slug: newUniverse.slug,
      description: newUniverse.description,
      visibility: newUniverse.visibility,
    });

  } catch (error) {
    console.error('Error creating universe:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
