export type FalModelType = 'image' | 'text2video' | 'img2video';

export interface FalModelOption {
  id: string; // fal model id
  label: string;
  type: FalModelType;
  description?: string;
  disabled?: boolean;
  recommended?: boolean;
}

export const IMAGE_MODELS: FalModelOption[] = [
  {
    id: 'fal-ai/flux-pro',
    label: 'FLUX Pro (Image)',
    type: 'image',
    recommended: true,
  },
  // WAN series placeholder; fill with exact model id when available
  {
    id: '',
    label: 'WAN (Image) – configure model id',
    type: 'image',
    disabled: true,
    description: 'Add the exact Wan image model id once confirmed',
  },
];

export const T2V_MODELS: FalModelOption[] = [
  {
    id: 'fal-ai/kling-2.1',
    label: 'Kling 2.1 (Text → Video)',
    type: 'text2video',
    recommended: true,
  },
  // WAN series placeholder; fill with exact model id when available
  {
    id: '',
    label: 'WAN (Text → Video) – configure model id',
    type: 'text2video',
    disabled: true,
  },
];

export const I2V_MODELS: FalModelOption[] = [
  {
    id: 'fal-ai/kling-2.1',
    label: 'Kling 2.1 (Image → Video)',
    type: 'img2video',
    recommended: true,
  },
  // WAN series placeholder; fill with exact model id when available
  {
    id: '',
    label: 'WAN (Image → Video) – configure model id',
    type: 'img2video',
    disabled: true,
  },
];

export function getDefaultModelId(type: FalModelType): string | undefined {
  const group = type === 'image' ? IMAGE_MODELS : type === 'text2video' ? T2V_MODELS : I2V_MODELS;
  return group.find((m) => m.recommended && !m.disabled)?.id || group.find((m) => !m.disabled)?.id;
}


