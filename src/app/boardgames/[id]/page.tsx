import { Dice6 } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function BoardGameDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="boardgames"
      mediaType="boardgame"
      title="Board Game"
      label="Board game"
      completeLabel="Mark as played"
      incompleteLabel="Remove played"
      icon={Dice6}
    />
  );
}
