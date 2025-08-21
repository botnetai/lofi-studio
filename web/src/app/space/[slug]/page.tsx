"use client";
import { trpc } from '@/lib/trpcClient';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import AudioMixer to reduce initial bundle size
const AudioMixer = dynamic(() => import('@/components/AudioMixer').then(mod => mod.AudioMixer), {
  loading: () => <div className="p-4 bg-gray-100 rounded-lg">Loading audio player...</div>,
  ssr: false // Audio components don't need SSR
});

export default function SpacePublicPage({ params }: { params: { slug: string } }) {
  const space = trpc.spaces.getBySlug.useQuery({ slug: params.slug });

  // Memoize space data to prevent unnecessary re-queries
  const spaceId = space.data?.id;

  const messages = trpc.spaceMessages.list.useQuery(
    { spaceId: spaceId ?? '00000000-0000-0000-0000-000000000000' },
    { enabled: !!spaceId }
  );

  const songs = trpc.songs.list.useQuery(
    { spaceId: spaceId ?? '' },
    { enabled: !!spaceId }
  );

  const spaceSFX = trpc.sfx.getSpaceEffects.useQuery(
    { spaceId: spaceId ?? '' },
    { enabled: !!spaceId }
  );

  // Only fetch artworks/videos if we have IDs to look for
  const backgroundArtworkId = space.data?.background_artwork_id;
  const backgroundVideoId = space.data?.background_video_id;

  const artworks = trpc.artwork.list.useQuery(
    { cursor: undefined, limit: 100 },
    { enabled: !!backgroundArtworkId }
  );

  const videos = trpc.video.list.useQuery(
    { cursor: undefined, limit: 100 },
    { enabled: !!backgroundVideoId }
  );

  const [sfxGains, setSfxGains] = useState<Map<string, number>>(new Map());

  // Memoize computed values to prevent unnecessary recalculations
  const { backgroundArtwork, backgroundVideo, mainAudioUrl, sfxEffects } = useMemo(() => {
    const bgArtwork = artworks.data?.find(a => a.id === backgroundArtworkId);
    const bgVideo = videos.data?.find(v => v.id === backgroundVideoId);
    const mainSong = songs.data?.[0];
    const audioUrl = mainSong?.r2_url;

    const effects = spaceSFX.data?.map(spaceSfx => ({
      id: spaceSfx.sfx_effect_id,
      name: spaceSfx.sfx_effects.name,
      display_name: spaceSfx.sfx_effects.display_name,
      r2_url: spaceSfx.sfx_effects.r2_url,
      gain: sfxGains.get(spaceSfx.sfx_effect_id) ?? spaceSfx.gain,
      default_gain: spaceSfx.sfx_effects.default_gain,
    })) ?? [];

    return {
      backgroundArtwork: bgArtwork,
      backgroundVideo: bgVideo,
      mainAudioUrl: audioUrl,
      sfxEffects: effects
    };
  }, [artworks.data, videos.data, songs.data, spaceSFX.data, sfxGains, backgroundArtworkId, backgroundVideoId]);

  const handleGainChange = (sfxId: string, gain: number) => {
    setSfxGains(prev => new Map(prev).set(sfxId, gain));
  };

  if (space.isLoading) return <div className="p-8">Loading…</div>;
  if (!space.data) return <div className="p-8">Not found</div>;

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold">{space.data.name}</h1>
      <div className="text-sm text-neutral-500">Visibility: {space.data.visibility}</div>

      {/* Background Display */}
      {backgroundArtwork?.r2_url && (
        <section>
          <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={backgroundArtwork.r2_url}
              alt="Space background"
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {backgroundVideo?.r2_url && (
        <section>
          <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
            <video
              src={backgroundVideo.r2_url}
              autoPlay
              loop
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Audio Mixer */}
      {(mainAudioUrl || sfxEffects.length > 0) && (
        <section>
          <h2 className="font-medium mb-2">Audio Experience</h2>
          <AudioMixer
            mainAudioUrl={mainAudioUrl}
            sfxEffects={sfxEffects}
            onGainChange={handleGainChange}
          />
        </section>
      )}

      {/* Messages/Chat */}
      {space.data.chat_enabled && (
        <section>
          <h2 className="font-medium mb-2">Messages</h2>
          <ul className="space-y-2">
            {messages.data?.map((m) => (
              <li key={m.id} className="text-sm">
                {m.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}


