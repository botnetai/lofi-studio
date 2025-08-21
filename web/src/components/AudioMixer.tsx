"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

interface SFXEffect {
  id: string;
  name: string;
  display_name: string;
  r2_url: string;
  gain: number;
  default_gain: number;
}

interface AudioMixerProps {
  mainAudioUrl?: string; // The main background music/song
  sfxEffects: SFXEffect[];
  onGainChange: (sfxId: string, gain: number) => void;
}

export function AudioMixer({ mainAudioUrl, sfxEffects, onGainChange }: AudioMixerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const mainGainNodeRef = useRef<GainNode | null>(null);
  const sfxAudioDataRef = useRef<Map<string, { gain: GainNode; buffer: AudioBuffer; source?: AudioBufferSourceNode }>>(new Map());
  const mainAudioBufferRef = useRef<AudioBuffer | null>(null);
  const mainSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [mainVolume, setMainVolume] = useState(1.0);

  // Memoize SFX effects to prevent unnecessary re-renders
  // SFX functionality commented out for MVP
  /*
  const memoizedSFXEffects = useMemo(() =>
    sfxEffects.map(effect => ({
      id: effect.id,
      gain: effect.gain,
      display_name: effect.display_name
    })),
    [sfxEffects]
  );
  */

  // Initialize AudioContext
  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Create main gain node
        mainGainNodeRef.current = audioContextRef.current.createGain();
        mainGainNodeRef.current.gain.value = mainVolume;
        mainGainNodeRef.current.connect(audioContextRef.current.destination);
      }
    };

    // Initialize on first user interaction
    const handleFirstInteraction = () => {
      initAudioContext();
      document.removeEventListener('click', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Load and play main audio
  useEffect(() => {
    if (!mainAudioUrl || !audioContextRef.current || !mainGainNodeRef.current) return;

    const loadMainAudio = async () => {
      try {
        const response = await fetch(mainAudioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

        // Stop any existing main source
        if (mainSourceRef.current) {
          mainSourceRef.current.stop();
        }

        // Store the audio buffer for reuse
        mainAudioBufferRef.current = audioBuffer;

        // Create new source
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        source.connect(mainGainNodeRef.current!);

        mainSourceRef.current = source;

        if (isPlaying) {
          source.start();
        }
      } catch (error) {
        console.error('Error loading main audio:', error);
        toast.error('Failed to load main audio');
      }
    };

    loadMainAudio();
  }, [mainAudioUrl, isPlaying]);

  // SFX effects loading - COMMENTED OUT FOR MVP
  // Load SFX effects when the list changes (not when gain changes)
  /*
  useEffect(() => {
    if (!audioContextRef.current) return;

    const currentEffectIds = new Set(sfxEffects.map(effect => effect.id));
    const existingEffectIds = new Set(sfxAudioDataRef.current.keys());

    // Remove effects that are no longer in the list
    for (const existingId of existingEffectIds) {
      if (!currentEffectIds.has(existingId)) {
        const existing = sfxAudioDataRef.current.get(existingId);
        if (existing?.source) {
          existing.source.stop();
        }
        sfxAudioDataRef.current.delete(existingId);
      }
    }

    // Load new effects that aren't already loaded
    const loadSFXEffect = async (effect: SFXEffect) => {
      if (sfxAudioDataRef.current.has(effect.id)) return; // Already loaded

      try {
        const response = await fetch(effect.r2_url);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio file: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

        // Create gain node
        const gainNode = audioContextRef.current!.createGain();
        gainNode.gain.value = effect.gain;
        gainNode.connect(audioContextRef.current!.destination);

        // Create source
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        source.connect(gainNode);

        // Store references
        sfxAudioDataRef.current.set(effect.id, { gain: gainNode, buffer: audioBuffer, source });

        if (isPlaying) {
          source.start();
        }
      } catch (error) {
        console.error(`Error loading SFX ${effect.name}:`, error);
        toast.error(`Failed to load SFX: ${effect.display_name}`);
      }
    };

    // Load all SFX effects that aren't already loaded
    sfxEffects.forEach(loadSFXEffect);

  }, [sfxEffects.map(effect => effect.id).join(','), isPlaying]); // Only depend on effect IDs, not gain values
  */

  // SFX gain changes - COMMENTED OUT FOR MVP
  // Handle SFX gain changes (separate from loading to avoid re-fetching audio)
  /*
  useEffect(() => {
    sfxEffects.forEach(effect => {
      const gainNode = sfxAudioDataRef.current.get(effect.id)?.gain;
      if (gainNode) {
        gainNode.gain.value = effect.gain;
      }
    });
  }, [sfxEffects.map(effect => `${effect.id}:${effect.gain}`).join(',')]); // Only depend on gain values
  */

  // Handle main volume changes
  useEffect(() => {
    if (mainGainNodeRef.current) {
      mainGainNodeRef.current.gain.value = mainVolume;
    }
  }, [mainVolume]);

  const togglePlay = useCallback(async () => {
    if (!audioContextRef.current) return;

    if (isPlaying) {
      // Pause all audio using AudioContext suspend
      try {
        await audioContextRef.current.suspend();
        setIsPlaying(false);
      } catch (error) {
        console.error('Error pausing audio:', error);
        toast.error('Failed to pause audio');
      }
    } else {
      // Resume audio using AudioContext resume
      try {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Start main audio if not already playing
        if (mainAudioUrl && mainGainNodeRef.current && !mainSourceRef.current) {
          let audioBuffer = mainAudioBufferRef.current;

          // Load audio buffer if not already cached
          if (!audioBuffer) {
            const response = await fetch(mainAudioUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch main audio: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            mainAudioBufferRef.current = audioBuffer;
          }

          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.loop = true;
          source.connect(mainGainNodeRef.current);
          source.start();
          mainSourceRef.current = source;
        }

        // SFX functionality commented out for MVP
        // Start any SFX that aren't already playing
        /*
        sfxEffects.forEach(effect => {
          const existing = sfxAudioDataRef.current.get(effect.id);
          if (existing && (!existing.source || existing.source.context.state === 'suspended')) {
            // Create a new source since the old one was stopped or context was suspended
            const source = audioContextRef.current!.createBufferSource();
            source.buffer = existing.buffer;
            source.loop = true;
            source.connect(existing.gain);
            source.start();
            existing.source = source;
          }
        });
        */

        setIsPlaying(true);
      } catch (error) {
        console.error('Error resuming audio:', error);
        toast.error('Failed to resume audio');
      }
    }
  }, [isPlaying]); // Removed sfxEffects dependency since SFX is commented out

  return (
    <div className="audio-mixer p-4 bg-gray-100 rounded-lg">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={togglePlay}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm">Main Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={mainVolume}
            onChange={(e) => setMainVolume(parseFloat(e.target.value))}
            className="w-20"
          />
          <span className="text-sm">{Math.round(mainVolume * 100)}%</span>
        </div>
      </div>

      {/* SFX controls commented out for MVP
      {sfxEffects.length > 0 && (
        <div className="sfx-controls">
          <h3 className="font-medium mb-2">SFX Effects:</h3>
          <div className="space-y-2">
            {memoizedSFXEffects.map((effect) => (
              <div key={effect.id} className="flex items-center gap-2 p-2 bg-white rounded">
                <span className="text-sm flex-1">{effect.display_name}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={effect.gain}
                  onChange={(e) => onGainChange(effect.id, parseFloat(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm w-8">{Math.round(effect.gain * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      */}
    </div>
  );
}
