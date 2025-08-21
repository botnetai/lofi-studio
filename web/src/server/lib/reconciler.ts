import { getServerSupabaseClient } from '../supabaseServer';
import { fetchStatus } from './elevenlabs';
import { invokeFal } from './fal';

// Reconciler configuration
const STUCK_GENERATION_THRESHOLD_MINUTES = 15; // Mark as failed after 15 minutes
const RECONCILER_INTERVAL_MINUTES = 5; // Run every 5 minutes

interface StuckGeneration {
  id: string;
  generation_id: string;
  provider: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function reconcileStuckGenerations() {
  const supabase = await getServerSupabaseClient();

  try {
    console.log('Running reconciler to check for stuck generations...');

    // Find stuck music generations
    const stuckMusicThreshold = new Date(Date.now() - STUCK_GENERATION_THRESHOLD_MINUTES * 60 * 1000);

    const { data: stuckMusic, error: musicError } = await supabase
      .from('songs')
      .select('id, generation_id, provider, status, created_at, updated_at')
      .eq('status', 'generating')
      .lt('updated_at', stuckMusicThreshold.toISOString());

    if (musicError) {
      console.error('Error fetching stuck music generations:', musicError);
    }

    // Find stuck artwork generations
    const { data: stuckArtwork, error: artworkError } = await supabase
      .from('artwork')
      .select('id, request_id, provider, status, created_at, updated_at')
      .eq('status', 'generating')
      .lt('updated_at', stuckMusicThreshold.toISOString());

    if (artworkError) {
      console.error('Error fetching stuck artwork generations:', artworkError);
    }

    // Find stuck video generations
    const { data: stuckVideos, error: videoError } = await supabase
      .from('videos')
      .select('id, request_id, provider, status, created_at, updated_at')
      .eq('status', 'generating')
      .lt('updated_at', stuckMusicThreshold.toISOString());

    if (videoError) {
      console.error('Error fetching stuck video generations:', videoError);
    }

    // Process stuck music generations
    if (stuckMusic && stuckMusic.length > 0) {
      console.log(`Found ${stuckMusic.length} stuck music generations`);
      await processStuckMusicGenerations(stuckMusic as StuckGeneration[]);
    }

    // Process stuck artwork generations
    if (stuckArtwork && stuckArtwork.length > 0) {
      console.log(`Found ${stuckArtwork.length} stuck artwork generations`);
      await processStuckArtworkGenerations(stuckArtwork);
    }

    // Process stuck video generations
    if (stuckVideos && stuckVideos.length > 0) {
      console.log(`Found ${stuckVideos.length} stuck video generations`);
      await processStuckVideoGenerations(stuckVideos);
    }

    console.log('Reconciler completed successfully');
  } catch (error) {
    console.error('Reconciler failed:', error);
  }
}

async function processStuckMusicGenerations(generations: StuckGeneration[]) {
  const supabase = await getServerSupabaseClient();

  for (const generation of generations) {
    try {
      console.log(`Processing stuck music generation ${generation.id} (${generation.generation_id})`);

      if (generation.provider === 'elevenlabs' && generation.generation_id) {
        // Try to fetch status one more time
        try {
          const status = await fetchStatus(generation.generation_id);

          if (status.status === 'completed' && status.url) {
            // Generation actually completed - update the record
            console.log(`Music generation ${generation.id} actually completed - updating record`);
            await supabase
              .from('songs')
              .update({
                status: 'completed',
                r2_url: status.url,
                duration_seconds: status.duration_seconds,
              })
              .eq('id', generation.id);
          } else {
            // Still not completed - mark as failed
            console.log(`Music generation ${generation.id} still not completed - marking as failed`);
            await supabase
              .from('songs')
              .update({ status: 'failed' })
              .eq('id', generation.id);
          }
        } catch (error) {
          console.error(`Failed to check status for music generation ${generation.id}:`, error);
          // Mark as failed if we can't check status
          await supabase
            .from('songs')
            .update({ status: 'failed' })
            .eq('id', generation.id);
        }
      } else {
        // Unknown provider or no generation_id - mark as failed
        console.log(`Marking music generation ${generation.id} as failed (unknown provider or no generation_id)`);
        await supabase
          .from('songs')
          .update({ status: 'failed' })
          .eq('id', generation.id);
      }
    } catch (error) {
      console.error(`Failed to process stuck music generation ${generation.id}:`, error);
    }
  }
}

async function processStuckArtworkGenerations(generations: any[]) {
  const supabase = await getServerSupabaseClient();

  for (const generation of generations) {
    try {
      console.log(`Processing stuck artwork generation ${generation.id} (${generation.request_id})`);

      // For now, just mark as failed - Fal.ai doesn't have a simple status check
      // In the future, we could implement webhook-based checking
      console.log(`Marking artwork generation ${generation.id} as failed`);
      await supabase
        .from('artwork')
        .update({ status: 'failed' })
        .eq('id', generation.id);
    } catch (error) {
      console.error(`Failed to process stuck artwork generation ${generation.id}:`, error);
    }
  }
}

async function processStuckVideoGenerations(generations: any[]) {
  const supabase = await getServerSupabaseClient();

  for (const generation of generations) {
    try {
      console.log(`Processing stuck video generation ${generation.id} (${generation.request_id})`);

      // For now, just mark as failed - Fal.ai doesn't have a simple status check
      // In the future, we could implement webhook-based checking
      console.log(`Marking video generation ${generation.id} as failed`);
      await supabase
        .from('videos')
        .update({ status: 'failed' })
        .eq('id', generation.id);
    } catch (error) {
      console.error(`Failed to process stuck video generation ${generation.id}:`, error);
    }
  }
}

// Export for use in API routes or scheduled jobs
export { RECONCILER_INTERVAL_MINUTES, STUCK_GENERATION_THRESHOLD_MINUTES };
