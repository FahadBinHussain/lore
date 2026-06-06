import { BookCopy } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function MangaDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="manga"
      mediaType="manga"
      title="Manga"
      label="Manga"
      completeLabel="Mark as read"
      incompleteLabel="Remove read"
      icon={BookCopy}
    />
  );
}
