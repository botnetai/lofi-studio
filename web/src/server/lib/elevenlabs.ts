import { logger } from './logger';
import { withMetrics } from './metrics';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/music';

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 10000; // 10 seconds

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES,
  delay: number = BASE_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    // Calculate exponential backoff with jitter
    const backoffDelay = Math.min(delay * Math.pow(2, MAX_RETRIES - retries), MAX_DELAY);
    const jitter = Math.random() * 0.1 * backoffDelay;
    const finalDelay = backoffDelay + jitter;

    console.log(`Retrying operation after ${finalDelay}ms. Retries left: ${retries - 1}`);

    await new Promise(resolve => setTimeout(resolve, finalDelay));
    return retryWithBackoff(operation, retries - 1, delay);
  }
}

export async function startGeneration(params: {
  prompt: string;
  makeInstrumental?: boolean;
  style?: string;
  title?: string;
  requestId?: string;
}): Promise<{ generationId: string }> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const requestId = params.requestId || `elevenlabs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('Starting ElevenLabs music generation', {
    requestId,
    operation: 'elevenlabs_start_generation',
    prompt: params.prompt.substring(0, 100) + '...'
  });

  const metricsHelper = withMetrics<{ generationId: string }>('elevenlabs_start_generation', undefined, {
    promptLength: params.prompt.length,
    hasTitle: !!params.title
  });

  try {
    const result = await retryWithBackoff(async () => {
      const res = await fetch(`${ELEVENLABS_API}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({
          prompt: params.prompt,
          make_instrumental: params.makeInstrumental ?? true,
          style: params.style,
          title: params.title,
        }),
      });

      if (!res.ok) {
        // Don't retry on client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`ElevenLabs start failed: ${res.status} ${res.statusText}`);
        }
        throw new Error(`ElevenLabs start failed: ${res.status}`);
      }

      const data = await res.json();
      return { generationId: data.generation_id ?? data.id ?? data.task_id };
    });

    logger.info('ElevenLabs generation started successfully', {
      requestId,
      operation: 'elevenlabs_start_generation',
      generationId: result.generationId
    });

    return metricsHelper.success({ generationId: result.generationId }, { generationId: result.generationId });
  } catch (error) {
    logger.error('ElevenLabs generation start failed', {
      requestId,
      operation: 'elevenlabs_start_generation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw metricsHelper.error(error as Error);
  }
}

export async function fetchStatus(generationId: string): Promise<{ status: string; url?: string; duration_seconds?: number }> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');

  return retryWithBackoff(async () => {
    const res = await fetch(`${ELEVENLABS_API}/status/${generationId}`, {
      headers: { 'xi-api-key': apiKey },
      cache: 'no-store',
    });

    if (!res.ok) {
      // Don't retry on client errors (4xx)
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`ElevenLabs status failed: ${res.status} ${res.statusText}`);
      }
      throw new Error(`ElevenLabs status failed: ${res.status}`);
    }

    const data = await res.json();
    return { status: data.status, url: data.audio_url ?? data.url, duration_seconds: data.duration_seconds };
  });
}

export async function downloadStream(url: string): Promise<Response> {
  return retryWithBackoff(async () => {
    const res = await fetch(url);
    if (!res.ok) {
      // Don't retry on client errors (4xx)
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`Download failed: ${res.status} ${res.statusText}`);
      }
      throw new Error(`Download failed: ${res.status}`);
    }
    return res;
  });
}


