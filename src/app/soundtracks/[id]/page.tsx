import { Music } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function SoundtrackDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="soundtracks"
      mediaType="soundtrack"
      title="Soundtrack"
      label="Soundtrack"
      completeLabel="Mark as listened"
      incompleteLabel="Remove listened"
      icon={Music}
    />
  );
}
