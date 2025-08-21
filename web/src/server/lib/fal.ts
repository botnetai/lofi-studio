import fal from '@fal-ai/client';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function initFal() {
  fal.config({ credentials: requireEnv('FAL_KEY') });
}

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

    console.log(`Retrying Fal.ai operation after ${finalDelay}ms. Retries left: ${retries - 1}`);

    await new Promise(resolve => setTimeout(resolve, finalDelay));
    return retryWithBackoff(operation, retries - 1, delay);
  }
}

export async function invokeFal(modelId: string, input: Record<string, any>) {
  initFal();

  return retryWithBackoff(async () => {
    try {
      const result = await fal.subscribe(modelId, {
        input,
        logs: false,
        onQueueUpdate: (update) => {
          if (update.status === 'FAILED') {
            throw new Error(`Fal.ai generation failed: ${update.error || 'Unknown error'}`);
          }
        },
      });
      return result;
    } catch (error) {
      // Check if it's a client error that shouldn't be retried
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          throw error; // Don't retry client errors
        }
      }
      throw error;
    }
  });
}


