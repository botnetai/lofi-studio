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
  { id: 'fal-ai/flux-pro', label: 'FLUX Pro (Image)', type: 'image', recommended: true },
  { id: '', label: 'WAN (Image) – configure model id', type: 'image', disabled: true },
];

export const T2V_MODELS: FalModelOption[] = [
  { id: 'fal-ai/kling-2.1', label: 'Kling 2.1 (Text → Video)', type: 'text2video', recommended: true },
  { id: '', label: 'WAN (Text → Video) – configure model id', type: 'text2video', disabled: true },
];

export const I2V_MODELS: FalModelOption[] = [
  { id: 'fal-ai/kling-2.1', label: 'Kling 2.1 (Image → Video)', type: 'img2video', recommended: true },
  { id: '', label: 'WAN (Image → Video) – configure model id', type: 'img2video', disabled: true },
];

export function getDefaultModelId(type: FalModelType): string | undefined {
  const group = type === 'image' ? IMAGE_MODELS : type === 'text2video' ? T2V_MODELS : I2V_MODELS;
  return group.find((m) => m.recommended && !m.disabled)?.id || group.find((m) => !m.disabled)?.id;
}

// Dynamic form field schema
export type FieldType = 'text' | 'number' | 'boolean' | 'select';
export interface ModelField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
}

export interface ModelSchema extends FalModelOption {
  fields: ModelField[];
}

export const IMAGE_MODEL_SCHEMAS: ModelSchema[] = [
  {
    id: 'fal-ai/flux-pro',
    label: 'FLUX Pro (Image)',
    type: 'image',
    recommended: true,
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'text', required: true },
    ],
  },
];

export const T2V_MODEL_SCHEMAS: ModelSchema[] = [
  {
    id: 'fal-ai/kling-2.1',
    label: 'Kling 2.1 (Text → Video)',
    type: 'text2video',
    recommended: true,
    fields: [
      { key: 'prompt', label: 'Prompt', type: 'text', required: true },
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 2, max: 8, step: 1, default: 6 },
      { key: 'mode', label: 'Mode', type: 'select', options: [
        { value: 'motion', label: 'Motion' },
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' },
      ], default: 'motion' },
    ],
  },
];

export const I2V_MODEL_SCHEMAS: ModelSchema[] = [
  {
    id: 'fal-ai/kling-2.1',
    label: 'Kling 2.1 (Image → Video)',
    type: 'img2video',
    recommended: true,
    fields: [
      { key: 'prompt', label: 'Prompt (optional)', type: 'text', required: false },
      { key: 'duration', label: 'Duration (s)', type: 'number', min: 2, max: 8, step: 1, default: 6 },
      { key: 'mode', label: 'Mode', type: 'select', options: [
        { value: 'motion', label: 'Motion' },
        { value: 'portrait', label: 'Portrait' },
        { value: 'landscape', label: 'Landscape' },
      ], default: 'motion' },
    ],
  },
];

