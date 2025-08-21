"use client";
import Link from 'next/link';
import { trpc } from '@/lib/trpcClient';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        <Card className="card-hover">
          <CardContent className="p-6">
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
                <Button size="lg" className="gradient-bg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Space
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

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
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400">Error loading spaces</h3>
                  <p className="text-sm text-red-500 dark:text-red-400">{error.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && (!data || data.length === 0) && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No spaces yet</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Create your first creative space to start generating music, artwork, and videos with AI.
              </p>
              <Link href="/spaces/new">
                <Button size="lg" className="gradient-bg">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Space
                </Button>
              </Link>
            </CardContent>
          </Card>
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
                <Card key={s.id} className="card-hover group cursor-pointer">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-lg">
                            {s.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {s.name}
                          </CardTitle>
                          <CardDescription className="flex items-center space-x-1">
                            <span>/{s.slug}</span>
                            <div className={`flex items-center space-x-1 text-xs ${
                              s.visibility === 'public'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {getVisibilityIcon(s.visibility)}
                              <span>{getVisibilityText(s.visibility)}</span>
                            </div>
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Created {new Date(s.created_at).toLocaleDateString()}
                    </div>

                    <div className="flex space-x-2">
                      <Link href={`/space/${s.slug}`} className="flex-1">
                        <Button size="sm" className="w-full gradient-bg group-hover:shadow-md transition-all">
                          <FolderOpen className="w-4 h-4 mr-2" />
                          Open Space
                        </Button>
                      </Link>

                      <Link href={`/space/${s.slug}/manage`}>
                        <Button size="sm" variant="outline" className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <Settings className="w-4 h-4" />
                        </Button>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


