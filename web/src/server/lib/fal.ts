import fal from '@fal-ai/client';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function initFal() {
  fal.config({ credentials: requireEnv('FAL_KEY') });
}

export async function invokeFal(modelId: string, input: Record<string, any>) {
  initFal();
  const result = await fal.subscribe(modelId, {
    input,
    logs: false,
    onQueueUpdate: () => {},
  });
  return result;
}


