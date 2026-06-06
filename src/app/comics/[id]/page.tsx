import { BookCopy } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function ComicDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="comics"
      mediaType="comic"
      title="Comic"
      label="Comic"
      completeLabel="Mark as read"
      incompleteLabel="Remove read"
      icon={BookCopy}
    />
  );
}
