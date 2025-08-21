import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lofi Studio - AI-Powered Creative Platform",
  description: "Create stunning music, artwork, and videos with AI. Your creative studio in the cloud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {/* Enhanced Navigation Header */}
          <header className="relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 gradient-bg opacity-10"></div>

            {/* Navigation */}
            <nav className="relative z-10 p-6">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Logo/Brand */}
                <Link href="/" className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">LS</span>
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-2xl font-bold gradient-text">Lofi Studio</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI Creative Platform</p>
                  </div>
                </Link>

                {/* Main Navigation */}
                <div className="hidden md:flex items-center space-x-8">
                  <Link href="/music" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium">
                    Music
                  </Link>
                  <Link href="/artwork" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium">
                    Artwork
                  </Link>
                  <Link href="/video" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium">
                    Video
                  </Link>
                  <Link href="/spaces" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors font-medium">
                    Spaces
                  </Link>
                </div>

                {/* User Actions */}
                <div className="flex items-center space-x-4">
                  <Link href="/account" className="text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-purple-400 transition-colors">
                    Account
                  </Link>
                  <Link href="/login" className="gradient-bg text-white px-6 py-2 rounded-full hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                    Login
                  </Link>
                </div>
              </div>
            </nav>
          </header>

          {/* Main Content */}
          <main className="min-h-screen">
            {children}
          </main>

          {/* Enhanced Footer */}
          <footer className="gradient-bg text-white py-12 mt-20">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                      <span className="text-white font-bold">LS</span>
                    </div>
                    <span className="text-xl font-bold">Lofi Studio</span>
                  </div>
                  <p className="text-white text-opacity-80 text-sm">
                    Your AI-powered creative studio in the cloud.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Create</h3>
                  <ul className="space-y-2 text-sm text-white text-opacity-80">
                    <li><Link href="/music" className="hover:text-white transition-colors">Music Generation</Link></li>
                    <li><Link href="/artwork" className="hover:text-white transition-colors">Artwork Creation</Link></li>
                    <li><Link href="/video" className="hover:text-white transition-colors">Video Production</Link></li>
                    <li><Link href="/spaces" className="hover:text-white transition-colors">Creative Spaces</Link></li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Resources</h3>
                  <ul className="space-y-2 text-sm text-white text-opacity-80">
                    <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                    <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                    <li><Link href="/support" className="hover:text-white transition-colors">Support</Link></li>
                    <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Company</h3>
                  <ul className="space-y-2 text-sm text-white text-opacity-80">
                    <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
                    <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                    <li><Link href="/careers" className="hover:text-white transition-colors">Careers</Link></li>
                    <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-white border-opacity-20 mt-8 pt-8 text-center text-sm text-white text-opacity-60">
                <p>&copy; 2024 Lofi Studio. All rights reserved. Powered by AI, crafted with love.</p>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
