import fal from '@fal-ai/client';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function initFal() {
  fal.config({ credentials: requireEnv('FAL_KEY') });
}

export async function createArtwork(params: { prompt: string; model?: string }) {
  initFal();
  const model = params.model ?? 'fal-ai/flux-pro';
  const result = await fal.subscribe(model, {
    input: { prompt: params.prompt },
    logs: false,
    onQueueUpdate: () => {},
  });
  const imageUrl = result.images?.[0]?.url ?? result.data?.image?.url ?? result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('Fal artwork: missing image URL');
  return { imageUrl, requestId: String(result.request_id ?? result.id ?? '') };
}

export async function createVideo(params: { prompt?: string; artworkUrl?: string; model?: string; duration?: number; mode?: string }) {
  initFal();
  const model = params.model ?? 'fal-ai/kling-2.1';
  const input: any = {};
  if (params.prompt) input.prompt = params.prompt;
  if (params.artworkUrl) input.image_url = params.artworkUrl;
  if (params.duration) input.duration = params.duration;
  if (params.mode) input.mode = params.mode;
  const result = await fal.subscribe(model, {
    input,
    logs: false,
    onQueueUpdate: () => {},
  });
  const videoUrl = result.video?.url ?? result.data?.video?.url ?? result.data?.videos?.[0]?.url;
  if (!videoUrl) throw new Error('Fal video: missing video URL');
  return { videoUrl, requestId: String(result.request_id ?? result.id ?? '') };
}


