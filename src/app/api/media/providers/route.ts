import { NextResponse } from 'next/server';
import { MEDIA_PROVIDER_REGISTRY } from '@/lib/media/provider-registry';

export async function GET() {
  return NextResponse.json({
    providers: MEDIA_PROVIDER_REGISTRY,
  });
}
