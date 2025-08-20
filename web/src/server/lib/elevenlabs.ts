function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/music';

export async function startGeneration(params: {
  prompt: string;
  makeInstrumental?: boolean;
  style?: string;
  title?: string;
}): Promise<{ generationId: string }> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');
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
  if (!res.ok) throw new Error(`ElevenLabs start failed: ${res.status}`);
  const data = await res.json();
  return { generationId: data.generation_id ?? data.id ?? data.task_id };
}

export async function fetchStatus(generationId: string): Promise<{ status: string; url?: string; duration_seconds?: number }> {
  const apiKey = requireEnv('ELEVENLABS_API_KEY');
  const res = await fetch(`${ELEVENLABS_API}/status/${generationId}`, {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ElevenLabs status failed: ${res.status}`);
  const data = await res.json();
  return { status: data.status, url: data.audio_url ?? data.url, duration_seconds: data.duration_seconds };
}

export async function downloadStream(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res;
}


