"use client";

import { useEffect, useRef, useState } from 'react';

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
  const sfxGainNodesRef = useRef<Map<string, { gain: GainNode; source?: AudioBufferSourceNode }>>(new Map());
  const mainSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [mainVolume, setMainVolume] = useState(1.0);

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
      }
    };

    loadMainAudio();
  }, [mainAudioUrl, isPlaying]);

  // Load and manage SFX effects
  useEffect(() => {
    if (!audioContextRef.current) return;

    const loadSFXEffect = async (effect: SFXEffect) => {
      try {
        const response = await fetch(effect.r2_url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

        // Stop any existing source for this effect
        const existing = sfxGainNodesRef.current.get(effect.id);
        if (existing?.source) {
          existing.source.stop();
        }

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
        sfxGainNodesRef.current.set(effect.id, { gain: gainNode, source });

        if (isPlaying) {
          source.start();
        }
      } catch (error) {
        console.error(`Error loading SFX ${effect.name}:`, error);
      }
    };

    // Load all SFX effects
    sfxEffects.forEach(loadSFXEffect);

    // Cleanup function to stop all SFX when effects change
    return () => {
      sfxEffects.forEach(effect => {
        const existing = sfxGainNodesRef.current.get(effect.id);
        if (existing?.source) {
          existing.source.stop();
        }
      });
    };
  }, [sfxEffects, isPlaying]);

  // Handle main volume changes
  useEffect(() => {
    if (mainGainNodeRef.current) {
      mainGainNodeRef.current.gain.value = mainVolume;
    }
  }, [mainVolume]);

  // Handle SFX gain changes
  useEffect(() => {
    sfxEffects.forEach(effect => {
      const gainNode = sfxGainNodesRef.current.get(effect.id)?.gain;
      if (gainNode) {
        gainNode.gain.value = effect.gain;
      }
    });
  }, [sfxEffects]);

  const togglePlay = () => {
    if (!audioContextRef.current) return;

    if (isPlaying) {
      // Pause all audio
      if (mainSourceRef.current) {
        mainSourceRef.current.stop();
        mainSourceRef.current = null;
      }

      sfxGainNodesRef.current.forEach(({ source }) => {
        if (source) {
          source.stop();
        }
      });

      setIsPlaying(false);
    } else {
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Restart main audio
      if (mainAudioUrl && mainGainNodeRef.current) {
        fetch(mainAudioUrl)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => audioContextRef.current!.decodeAudioData(arrayBuffer))
          .then(audioBuffer => {
            const source = audioContextRef.current!.createBufferSource();
            source.buffer = audioBuffer;
            source.loop = true;
            source.connect(mainGainNodeRef.current!);
            source.start();
            mainSourceRef.current = source;
          });
      }

      // Restart all SFX
      sfxEffects.forEach(async (effect) => {
        try {
          const response = await fetch(effect.r2_url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

          const gainNode = sfxGainNodesRef.current.get(effect.id)?.gain ||
            audioContextRef.current!.createGain();
          gainNode.gain.value = effect.gain;
          gainNode.connect(audioContextRef.current!.destination);

          const source = audioContextRef.current!.createBufferSource();
          source.buffer = audioBuffer;
          source.loop = true;
          source.connect(gainNode);

          sfxGainNodesRef.current.set(effect.id, { gain: gainNode, source });
          source.start();
        } catch (error) {
          console.error(`Error restarting SFX ${effect.name}:`, error);
        }
      });

      setIsPlaying(true);
    }
  };

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

      {sfxEffects.length > 0 && (
        <div className="sfx-controls">
          <h3 className="font-medium mb-2">SFX Effects:</h3>
          <div className="space-y-2">
            {sfxEffects.map((effect) => (
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
    </div>
  );
}
