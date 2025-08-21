"use client";
import { trpc } from '@/lib/trpcClient';
import { AudioMixer } from '@/components/AudioMixer';
import { useState } from 'react';

export default function SpacePublicPage({ params }: { params: { slug: string } }) {
  const space = trpc.spaces.getBySlug.useQuery({ slug: params.slug });
  const messages = trpc.spaceMessages.list.useQuery({ spaceId: space.data?.id ?? '00000000-0000-0000-0000-000000000000' }, { enabled: !!space.data?.id });
  const songs = trpc.songs.list.useQuery({ spaceId: space.data?.id ?? '' }, { enabled: !!space.data?.id });
  const spaceSFX = trpc.sfx.getSpaceEffects.useQuery({ spaceId: space.data?.id ?? '' }, { enabled: !!space.data?.id });

  // Get background artwork/video data if needed
  const artworks = trpc.artwork.list.useQuery(
    { cursor: undefined, limit: 100 },
    { enabled: !!space.data?.background_artwork_id }
  );
  const videos = trpc.video.list.useQuery(
    { cursor: undefined, limit: 100 },
    { enabled: !!space.data?.background_video_id }
  );

  const backgroundArtwork = artworks.data?.find(a => a.id === space.data?.background_artwork_id);
  const backgroundVideo = videos.data?.find(v => v.id === space.data?.background_video_id);

  const [sfxGains, setSfxGains] = useState<Map<string, number>>(new Map());

  // Get the first song for main audio (could be enhanced to handle playlists)
  const mainSong = songs.data?.[0];
  const mainAudioUrl = mainSong?.r2_url;

  // Prepare SFX effects with current gain values
  const sfxEffects = spaceSFX.data?.map(spaceSfx => ({
    id: spaceSfx.sfx_effect_id,
    name: spaceSfx.sfx_effects.name,
    display_name: spaceSfx.sfx_effects.display_name,
    r2_url: spaceSfx.sfx_effects.r2_url,
    gain: sfxGains.get(spaceSfx.sfx_effect_id) ?? spaceSfx.gain,
    default_gain: spaceSfx.sfx_effects.default_gain,
  })) ?? [];

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


