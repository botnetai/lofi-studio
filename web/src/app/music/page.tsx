"use client";
import { trpc } from '@/lib/trpcClient';
import { useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Music,
  Play,
  Pause,
  Download,
  Trash2,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export default function MusicPage() {
  const [prompt, setPrompt] = useState('cozy lofi, vinyl crackle, mellow, relaxing');
  const [title, setTitle] = useState('Untitled');
  const [spaceId, setSpaceId] = useState('');
  const [style, setStyle] = useState('lofi');
  const [makeInstrumental, setMakeInstrumental] = useState(false);

  const create = trpc.music.create.useMutation();
  const finalize = trpc.music.finalize.useMutation();
  const { data: songs, refetch, isLoading } = trpc.music.list.useQuery({}, { refetchInterval: 3000 });
  const spaces = trpc.spaces.list.useQuery({ ownerOnly: true });
  const remove = trpc.music.delete.useMutation({ onSuccess: () => refetch() });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      case 'generating': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'generating': return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold gradient-text mb-4">AI Music Studio</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Create unique music with AI. From lofi beats to ambient soundscapes - let your imagination guide the melody.
          </p>
        </div>

        {/* Generation Form */}
        <Card className="card-hover">
          <CardHeader className="pb-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Generate New Track</CardTitle>
                <CardDescription>
                  Describe your music and let AI create something amazing
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
      <form
              className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
                if (!spaceId) return;

                const res = await create.mutateAsync({
                  spaceId,
                  prompt,
                  title,
                  style,
                  makeInstrumental
                });

                // Reset form on success
                if (res) {
                  setTitle('Untitled');
                  setPrompt('cozy lofi, vinyl crackle, mellow, relaxing');
                }
              }}
            >
              {/* Space Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Choose Workspace
                </label>
                <Select value={spaceId} onValueChange={setSpaceId}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Select a workspace for your track..." />
                  </SelectTrigger>
                  <SelectContent>
          {spaces.data?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 gradient-bg rounded-md"></div>
                          <span>{s.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Track Title
                </label>
                <Input
                  type="text"
                  placeholder="Give your track a name..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Style Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Music Style
                </label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lofi">Lofi Hip Hop</SelectItem>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="jazz">Jazz</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Music Description
                </label>
                <Textarea
                  placeholder="Describe the mood, instruments, tempo, and vibe you want..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Be specific about the atmosphere, instruments, and emotional tone you want to achieve.
                </p>
              </div>

              {/* Options */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <input
                  type="checkbox"
                  id="instrumental"
                  checked={makeInstrumental}
                  onChange={(e) => setMakeInstrumental(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded"
                />
                <label htmlFor="instrumental" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Instrumental only (no vocals)
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                disabled={create.isPending || !spaceId}
                className="w-full h-14 gradient-bg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                {create.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Creating Your Track...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Music
                  </>
                )}
              </Button>

              {create.error && (
                <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-sm text-red-600 dark:text-red-400">
                      {create.error.message}
                    </span>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Generated Songs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Music className="w-5 h-5" />
              <span>Your Tracks</span>
            </CardTitle>
            <CardDescription>
              Manage your generated music and download completed tracks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse p-4 border rounded-lg">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && (!songs || songs.length === 0) && (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  No tracks yet
                </h3>
                <p className="text-gray-500 dark:text-gray-500 mb-4">
                  Create your first AI-generated track above to get started!
                </p>
              </div>
            )}

            <div className="space-y-3">
              {songs?.map((s) => (
                <div key={s.id} className="card-hover p-4 border rounded-lg hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {s.title ?? 'Untitled'}
                        </h3>
                        <div className={`flex items-center space-x-1 ${getStatusColor(s.status)}`}>
                          {getStatusIcon(s.status)}
                          <span className="text-sm capitalize">{s.status}</span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                        <div className="flex items-center space-x-4">
                          <span>{s.duration_seconds ? `${s.duration_seconds}s` : '—'}</span>
                          <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                {s.r2_url ? (
                        <div className="flex items-center space-x-2">
                          <audio controls src={s.r2_url} className="h-8 w-48" />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(s.r2_url!, '_blank')}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!s.generation_id}
                    onClick={async () => {
                      if (!s.generation_id) return;
                      await finalize.mutateAsync({ id: s.id, generationId: s.generation_id });
                      refetch();
                    }}
                  >
                          {finalize.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Finalize'
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                  onClick={async () => {
                          if (!confirm('Are you sure you want to delete this track?')) return;
                    await remove.mutateAsync({ id: s.id });
                  }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
              </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


