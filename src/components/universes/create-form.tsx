'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateUniverseFormData {
  name: string;
  description: string;
  coverImage: File | null;
  bannerImage: File | null;
  selectedItems: MediaItem[];
}

interface MediaItem {
  id: number;
  title: string;
  type: string;
  image?: string;
}

export function CreateUniverseForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState<CreateUniverseFormData>({
    name: '',
    description: '',
    coverImage: null,
    bannerImage: null,
    selectedItems: [],
  });

  const handleInputChange = (field: keyof CreateUniverseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: 'coverImage' | 'bannerImage', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const addItem = (item: MediaItem) => {
    if (!formData.selectedItems.find(i => i.id === item.id)) {
      setFormData(prev => ({
        ...prev,
        selectedItems: [...prev.selectedItems, item]
      }));
    }
  };

  const removeItem = (itemId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter(i => i.id !== itemId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Universe name is required');
      return;
    }

    setIsLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('selectedItems', JSON.stringify(formData.selectedItems));

      if (formData.coverImage) {
        submitData.append('coverImage', formData.coverImage);
      }

      if (formData.bannerImage) {
        submitData.append('bannerImage', formData.bannerImage);
      }

      const response = await fetch('/api/universes/create', {
        method: 'POST',
        body: submitData,
      });

      if (!response.ok) {
        throw new Error('Failed to create universe');
      }

      const result = await response.json();

      alert('Universe created successfully!');
      router.push(`/universes/${result.slug}`);
    } catch (error) {
      console.error('Error creating universe:', error);
      alert('Failed to create universe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          Universe Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Universe Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter universe name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe this universe collection..."
              rows={4}
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image</Label>
            <div className="flex items-center gap-4">
              <Input
                id="coverImage"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange('coverImage', e.target.files?.[0] || null)}
                className="hidden"
              />
              <Label htmlFor="coverImage" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>{formData.coverImage ? formData.coverImage.name : 'Choose cover image'}</span>
                </div>
              </Label>
              {formData.coverImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileChange('coverImage', null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Banner Image */}
          <div className="space-y-2">
            <Label htmlFor="bannerImage">Banner Image</Label>
            <div className="flex items-center gap-4">
              <Input
                id="bannerImage"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange('bannerImage', e.target.files?.[0] || null)}
                className="hidden"
              />
              <Label htmlFor="bannerImage" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>{formData.bannerImage ? formData.bannerImage.name : 'Choose banner image'}</span>
                </div>
              </Label>
              {formData.bannerImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFileChange('bannerImage', null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Media Items */}
          <div className="space-y-4">
            <Label>Media Items</Label>
            
            {/* Search */}
            <div className="flex gap-2">
              <Input
                placeholder="Search for movies, TV shows, games, books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button type="button" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                <h4 className="font-medium mb-2">Search Results</h4>
                <div className="space-y-2">
                  {searchResults.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {item.image && (
                          <img src={item.image} alt={item.title} className="w-8 h-8 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addItem(item)}
                        disabled={formData.selectedItems.some(i => i.id === item.id)}
                      >
                        {formData.selectedItems.some(i => i.id === item.id) ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Items */}
            {formData.selectedItems.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Selected Items ({formData.selectedItems.length})</h4>
                <div className="space-y-2">
                  {formData.selectedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {item.image && (
                          <img src={item.image} alt={item.title} className="w-8 h-8 object-cover rounded" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-6">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Creating...' : 'Create Universe'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}