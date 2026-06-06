import {
  getMediaDetailHref,
  isTrackableMediaSource,
  type MediaProviderItem,
} from './provider-registry';

export type { MediaProviderItem };
export { getMediaDetailHref };

export function isApiBackedMediaItem(mediaItem: MediaProviderItem): boolean {
  if (mediaItem.isPlaceholder) return false;
  return isTrackableMediaSource(mediaItem.mediaType, mediaItem.source);
}

export function getTimelineItemState(mediaItem: MediaProviderItem): 'trackable' | 'curated' {
  return isApiBackedMediaItem(mediaItem) ? 'trackable' : 'curated';
}
