"use client";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpcClient";
import Link from "next/link";
import {
  Music,
  Palette,
  Video,
  Sparkles,
  ArrowRight,
  Star,
  Zap,
  Users,
  CheckCircle
} from "lucide-react";

export default function HomeClient() {
  const ping = trpc.health.ping.useQuery();

  const features = [
    {
      icon: <Music className="w-6 h-6" />,
      title: "AI Music Generation",
      description: "Create unique lofi beats, ambient sounds, and background music with advanced AI algorithms.",
      href: "/music",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <Palette className="w-6 h-6" />,
      title: "Artwork Creation",
      description: "Generate stunning visuals, album art, and creative illustrations with AI-powered tools.",
      href: "/artwork",
      color: "from-blue-500 to-teal-500"
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: "Video Production",
      description: "Produce engaging video content with AI-assisted editing and effects.",
      href: "/video",
      color: "from-orange-500 to-red-500"
    }
  ];

  const testimonials = [
    {
      name: "Alex Chen",
      role: "Indie Artist",
      content: "Lofi Studio transformed my music production workflow. What used to take hours now takes minutes.",
      avatar: "AC"
    },
    {
      name: "Sarah Kim",
      role: "Content Creator",
      content: "The artwork generation is incredible. I've created hundreds of unique pieces for my brand.",
      avatar: "SK"
    },
    {
      name: "Marcus Johnson",
      role: "Video Producer",
      content: "This platform has revolutionized how I approach creative projects. Absolutely game-changing.",
      avatar: "MJ"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 gradient-bg opacity-5"></div>
        <div className="absolute top-20 left-10 w-72 h-72 gradient-bg rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 gradient-bg-secondary rounded-full opacity-10 blur-3xl"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full glass-effect mb-8">
              <Sparkles className="w-4 h-4 text-purple-500 mr-2" />
              <span className="text-sm font-medium">AI-Powered Creative Studio</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="gradient-text">Create</span>{" "}
              <span className="text-gray-900 dark:text-white">Amazing</span>
              <br />
              <span className="text-gray-900 dark:text-white">Content with</span>{" "}
              <span className="gradient-text">AI</span>
            </h1>

            {/* Subheading */}
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Transform your creative workflow with AI-powered music generation, artwork creation,
              and video production. Your imagination is the only limit.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/spaces">
                <Button size="lg" className="gradient-bg text-white px-8 py-4 rounded-full text-lg font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  Start Creating <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="px-8 py-4 rounded-full text-lg font-semibold border-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  View Pricing
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold gradient-text mb-2">10K+</div>
                <div className="text-gray-600 dark:text-gray-400">Songs Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold gradient-text mb-2">50K+</div>
                <div className="text-gray-600 dark:text-gray-400">Artworks Generated</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold gradient-text mb-2">5K+</div>
                <div className="text-gray-600 dark:text-gray-400">Happy Creators</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Create
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Powerful AI tools designed to enhance your creativity and streamline your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link key={index} href={feature.href}>
                <div className="card-hover glass-effect p-8 rounded-2xl h-full group cursor-pointer">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <div className="text-white">{feature.icon}</div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Get started in minutes with our simple workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Choose Your Tool</h3>
              <p className="text-gray-600 dark:text-gray-300">Select from music generation, artwork creation, or video production tools.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Set Your Parameters</h3>
              <p className="text-gray-600 dark:text-gray-300">Describe what you want to create. Our AI understands natural language.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Create & Refine</h3>
              <p className="text-gray-600 dark:text-gray-300">Generate your content and use our tools to perfect it to your vision.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Loved by Creators
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See what our community is saying about Lofi Studio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="glass-effect p-6 rounded-2xl">
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center text-white font-semibold mr-3">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{testimonial.role}</div>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-300 italic">"{testimonial.content}"</p>
                <div className="flex text-yellow-400 mt-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Start Creating?
          </h2>
          <p className="text-xl text-white text-opacity-90 mb-8">
            Join thousands of creators who trust Lofi Studio for their creative projects.
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 transform hover:scale-105">
              Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Status Indicator */}
      <div className="fixed bottom-4 right-4">
        <div className="glass-effect px-4 py-2 rounded-full flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${ping.data?.ok ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            System {ping.data?.ok ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}


