import { Podcast } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function PodcastDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="podcasts"
      mediaType="podcast"
      title="Podcast"
      label="Podcast"
      completeLabel="Mark as listened"
      incompleteLabel="Remove listened"
      icon={Podcast}
    />
  );
}
