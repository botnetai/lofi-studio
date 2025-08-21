"use client";

// SFXSelector component - COMMENTED OUT FOR MVP
// SFX functionality moved to LATER section of migration plan

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

// Placeholder export for MVP
export function SFXSelector({ spaceId, currentSFX, onSFXChange }: SFXSelectorProps) {
  return (
    <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-500">
      SFX Effects - Coming in future update
    </div>
  );
}
