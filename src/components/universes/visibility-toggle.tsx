'use client';

import { useState } from 'react';
import { Globe, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UniverseVisibilityToggleProps {
  universeId: number;
  currentVisibility: 'public' | 'private' | 'unlisted';
}

export function UniverseVisibilityToggle({ universeId, currentVisibility }: UniverseVisibilityToggleProps) {
  const [visibility, setVisibility] = useState(currentVisibility);
  const [updating, setUpdating] = useState(false);

  const isPublic = visibility === 'public';

  async function toggle() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/universes/${universeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: isPublic ? 'private' : 'public' }),
      });
      if (!res.ok) throw new Error('Failed to update visibility');
      const data = await res.json();
      setVisibility(data.collection.visibility);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={updating}
      className="gap-1.5 text-xs"
    >
      {updating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPublic ? (
        <Globe className="h-3.5 w-3.5" />
      ) : (
        <Lock className="h-3.5 w-3.5" />
      )}
      {isPublic ? 'Public' : 'Private'}
    </Button>
  );
}