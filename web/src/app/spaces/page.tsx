"use client";
import Link from 'next/link';
import { trpc } from '@/lib/trpcClient';
// Using basic HTML elements instead of shadcn/ui components for now
// TODO: Set up shadcn/ui properly later
import {
  Plus,
  FolderOpen,
  Settings,
  Users,
  Calendar,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sparkles
} from "lucide-react";

export const dynamic = 'force-dynamic';

export default function SpacesPage() {
  const { data, isLoading, error } = trpc.spaces.list.useQuery({ ownerOnly: true });

  const getVisibilityIcon = (visibility: string) => {
    return visibility === 'public' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />;
  };

  const getVisibilityText = (visibility: string) => {
    return visibility === 'public' ? 'Public' : 'Private';
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold gradient-text mb-4">Your Creative Spaces</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Organize your AI-generated content in dedicated workspaces. Each space is your personal studio.
          </p>
        </div>

        {/* Create New Space */}
        <div className="card-hover bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Space</h3>
                  <p className="text-gray-600 dark:text-gray-300">Start a new creative project with AI-powered tools</p>
                </div>
              </div>
              <Link href="/spaces/new">
                <button className="gradient-bg text-white px-6 py-3 rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105 font-semibold flex items-center space-x-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Create Space</span>
                </button>
              </Link>
            </div>
          </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6">
                <div className="animate-pulse">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/4"></div>
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-20"></div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-20"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400">Error loading spaces</h3>
                  <p className="text-sm text-red-500 dark:text-red-400">{error.message}</p>
                </div>
              </div>
            </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No spaces yet</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Create your first creative space to start generating music, artwork, and videos with AI.
              </p>
              <Link href="/spaces/new">
                <button className="gradient-bg text-white px-6 py-3 rounded-full font-semibold flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Space</span>
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Spaces Grid */}
        {!isLoading && !error && data && data.length > 0 && (
      <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your Spaces ({data.length})
              </h2>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Manage your creative projects
      </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.map((s) => (
                <div key={s.id} className="card-hover group cursor-pointer bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="pb-4 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-lg">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors font-semibold">
                            {s.name}
                          </h3>
                          <p className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                            <span>/{s.slug}</span>
                            <div className={`flex items-center space-x-1 text-xs ${
                              s.visibility === 'public'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {getVisibilityIcon(s.visibility)}
                              <span>{getVisibilityText(s.visibility)}</span>
                            </div>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-0 px-6 pb-6">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Created {new Date(s.created_at).toLocaleDateString()}
                    </div>

                    <div className="flex space-x-2">
                      <Link href={`/space/${s.slug}`} className="flex-1">
                        <button className="w-full gradient-bg text-white px-4 py-2 rounded-md group-hover:shadow-md transition-all flex items-center justify-center space-x-2">
                          <FolderOpen className="w-4 h-4" />
                          <span>Open Space</span>
                        </button>
                      </Link>

                      <Link href={`/space/${s.slug}/manage`}>
                        <button className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      </Link>
                    </div>

                    {/* Space Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <div className="font-semibold text-gray-900 dark:text-white">—</div>
                          <div>Tracks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-gray-900 dark:text-white">—</div>
                          <div>Artworks</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


