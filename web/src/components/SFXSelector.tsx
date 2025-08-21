"use client";

import { useState } from 'react';
import { trpc } from '@/lib/trpcClient';

interface SFXEffect {
  id: string;
  name: string;
  display_name: string;
  category: string;
  description?: string;
  r2_url: string;
  duration_seconds?: number;
  default_gain: number;
}

interface SpaceSFX {
  id: string;
  gain: number;
  position: number;
  sfx_effect_id: string;
  sfx_effects: SFXEffect;
}

interface SFXSelectorProps {
  spaceId: string;
  currentSFX: SpaceSFX[];
  onSFXChange: () => void;
}

export function SFXSelector({ spaceId, currentSFX, onSFXChange }: SFXSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const { data: availableEffects } = trpc.sfx.listEffects.useQuery(
    selectedCategory === 'all' ? {} : { category: selectedCategory as any }
  );

  const addSFX = trpc.sfx.addSpaceEffect.useMutation();
  const updateSFX = trpc.sfx.updateSpaceEffect.useMutation();
  const removeSFX = trpc.sfx.removeSpaceEffect.useMutation();
  const reorderSFX = trpc.sfx.reorderSpaceEffects.useMutation();

  const handleAddSFX = async (effectId: string) => {
    setIsLoading(true);
    try {
      await addSFX.mutateAsync({ spaceId, sfxEffectId: effectId });
      onSFXChange();
    } catch (error) {
      console.error('Error adding SFX:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateGain = async (spaceSfxId: string, gain: number) => {
    try {
      await updateSFX.mutateAsync({ spaceSfxId, gain });
      onSFXChange();
    } catch (error) {
      console.error('Error updating SFX gain:', error);
    }
  };

  const handleRemoveSFX = async (spaceSfxId: string) => {
    setIsLoading(true);
    try {
      await removeSFX.mutateAsync({ spaceSfxId });
      onSFXChange();
    } catch (error) {
      console.error('Error removing SFX:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorder = async (spaceSfxIds: string[]) => {
    try {
      await reorderSFX.mutateAsync({ spaceId, spaceSfxIds });
      onSFXChange();
    } catch (error) {
      console.error('Error reordering SFX:', error);
    }
  };

  const categories = ['all', 'nature', 'ambience', 'weather', 'urban', 'other'];
  const currentSFXIds = new Set(currentSFX.map(sfx => sfx.sfx_effect_id));

  return (
    <div className="sfx-selector p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">SFX Effects</h2>

      {/* Current SFX Effects */}
      {currentSFX.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium mb-2">Active Effects:</h3>
          <div className="space-y-2">
            {currentSFX
              .sort((a, b) => a.position - b.position)
              .map((spaceSfx) => (
                <div key={spaceSfx.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <span className="flex-1">{spaceSfx.sfx_effects.display_name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={spaceSfx.gain}
                      onChange={(e) => handleUpdateGain(spaceSfx.id, parseFloat(e.target.value))}
                      className="w-20"
                    />
                    <span className="text-sm w-8">{Math.round(spaceSfx.gain * 100)}%</span>
                    <button
                      onClick={() => handleRemoveSFX(spaceSfx.id)}
                      disabled={isLoading}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Filter by Category:</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border rounded p-2"
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Available Effects */}
      <div className="mb-4">
        <h3 className="font-medium mb-2">Available Effects:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {availableEffects?.map((effect) => {
            const isAdded = currentSFXIds.has(effect.id);
            return (
              <div key={effect.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-medium">{effect.display_name}</div>
                  {effect.description && (
                    <div className="text-sm text-gray-600">{effect.description}</div>
                  )}
                  <div className="text-xs text-gray-500">{effect.category}</div>
                </div>
                <button
                  onClick={() => handleAddSFX(effect.id)}
                  disabled={isAdded || isLoading}
                  className={`px-3 py-1 rounded text-sm ${
                    isAdded
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {isAdded ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {currentSFX.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No SFX effects added yet. Choose from the available effects above to enhance your space's atmosphere.
        </div>
      )}
    </div>
  );
}
