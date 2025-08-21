import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add caching headers for static assets
  const url = request.nextUrl.pathname;

  // Cache static assets aggressively
  if (url.startsWith('/_next/static/') || url.startsWith('/public/')) {
    response.headers.set(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
  }



  // Cache API routes that are safe to cache (GET requests only)
  if (url.startsWith('/api/') && !url.includes('/webhooks/') && request.method === 'GET') {
    response.headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=300' // 5 minutes
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/_next/static/:path*',
    '/public/:path*',
    '/api/:path*',
    '/(.*\\.(jpg|jpeg|png|gif|svg|webp|avif|mp3|mp4|webm|ogg))$'
  ]
};
