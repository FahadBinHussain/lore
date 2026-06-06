import { MapPin } from 'lucide-react';
import { GenericMediaDetailPage } from '@/components/media/generic-detail-page';

export default function ThemeParkDetailPage() {
  return (
    <GenericMediaDetailPage
      apiBase="themeparks"
      mediaType="themepark"
      title="Theme Park"
      label="Theme park attraction"
      completeLabel="Mark as visited"
      incompleteLabel="Remove visit"
      icon={MapPin}
    />
  );
}
