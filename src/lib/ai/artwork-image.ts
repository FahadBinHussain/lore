/**
 * Fetch the artwork reference image the viewer is looking at and hand it to the
 * zen lane as a base64 `data:` URL.
 *
 * Why base64 instead of passing the https URL: the provider will happily fetch
 * a public URL itself (verified 2026-10-23), but when that fetch is blocked
 * there is no error anywhere — the model just answers from metadata as if the
 * image had never been sent. Building the data URL here keeps the round-trip
 * observable: a blocked host, a non-image body, or an oversized file fails
 * loudly in the route instead of degrading silently.
 *
 * Refs-only rule still holds: the bytes live in memory for one request and are
 * never written to disk, the DB, or the repo.
 */

/** ~5 MB of raw image ≈ 6.7 MB of base64 — below the gateway's request ceiling. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_USER_AGENT = 'Mozilla/5.0 (compatible; lore-artwork-chat/1.0; +https://univrs.vercel.app)';

export class ArtworkImageError extends Error {
  status: number | null;
  imageUrl: string;

  constructor(message: string, imageUrl: string, status: number | null = null) {
    super(message);
    this.name = 'ArtworkImageError';
    this.imageUrl = imageUrl;
    this.status = status;
  }
}

export type ArtworkImage = {
  /** `data:<mime>;base64,<payload>` ready for an `image_url` content part. */
  dataUrl: string;
  bytes: number;
  contentType: string;
};

/** `image/jpg` is what wikiart serves; only `image/jpeg` is a real MIME type. */
function normalizeImageType(raw: string): string | null {
  const type = raw.split(';')[0].trim().toLowerCase();
  if (type === 'image/jpg' || type === 'image/pjpeg') return 'image/jpeg';
  if (type.startsWith('image/')) return type;
  return null;
}

/** btoa needs a binary string; chunk the bytes so a 5 MB buffer cannot blow the stack. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

export async function loadArtworkImage(imageUrl: string, signal?: AbortSignal): Promise<ArtworkImage> {
  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new ArtworkImageError(`Artwork image URL is not http(s): ${imageUrl}`, imageUrl);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`image fetch timed out after ${IMAGE_FETCH_TIMEOUT_MS}ms`)), IMAGE_FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(imageUrl, {
      headers: { Accept: 'image/*', 'User-Agent': IMAGE_USER_AGENT },
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ArtworkImageError(`Could not download the artwork image from ${imageUrl} (${message}).`, imageUrl);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }

  if (!response.ok) {
    throw new ArtworkImageError(
      `The artwork image host answered HTTP ${response.status} for ${imageUrl}.`,
      imageUrl,
      response.status
    );
  }

  const contentType = normalizeImageType(response.headers.get('content-type') ?? '');
  if (!contentType) {
    throw new ArtworkImageError(
      `The artwork image host returned "${response.headers.get('content-type') ?? 'no content-type'}" instead of an image for ${imageUrl}.`,
      imageUrl,
      response.status
    );
  }

  const declaredLength = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new ArtworkImageError(
      `The artwork image is ${(declaredLength / 1024 / 1024).toFixed(1)} MB, over the ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB vision limit (${imageUrl}).`,
      imageUrl,
      response.status
    );
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  if (!buffer.byteLength) {
    throw new ArtworkImageError(`The artwork image host returned an empty body for ${imageUrl}.`, imageUrl, response.status);
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ArtworkImageError(
      `The artwork image is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB, over the ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)} MB vision limit (${imageUrl}).`,
      imageUrl,
      response.status
    );
  }

  return {
    dataUrl: `data:${contentType};base64,${toBase64(buffer)}`,
    bytes: buffer.byteLength,
    contentType,
  };
}
