# 🎵 Lofi Studio - AI-Powered Creative Platform

![Lofi Studio](https://img.shields.io/badge/Lofi%20Studio-AI%20Creative%20Platform-667eea?style=for-the-badge&logo=music&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15.4.7-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

> Transform your creative workflow with AI-powered music generation, artwork creation, and video production. Your imagination is the only limit.

![Lofi Studio Preview](./public/preview.png)

## ✨ Features

### 🎵 AI Music Generation
- **Advanced AI Algorithms** - Generate unique lofi beats, ambient sounds, and background music
- **Style Variety** - Lofi Hip Hop, Ambient, Electronic, Jazz, Classical, and Rock
- **Custom Parameters** - Control mood, instruments, tempo, and emotional tone
- **Real-time Generation** - See your tracks come to life with live status updates
- **Audio Playback** - Built-in player with download functionality

### 🎨 Artwork Creation
- **AI-Powered Generation** - Create stunning visuals, album art, and creative illustrations
- **Multiple Models** - Support for various AI art generation models
- **Custom Prompts** - Natural language descriptions for precise results
- **High Resolution** - Generate artwork suitable for professional use

### 🎬 Video Production
- **AI-Assisted Editing** - Smart video editing with AI recommendations
- **Effect Generation** - Automated video effects and transitions
- **Content Creation** - Produce engaging video content with AI guidance

### 🏢 Creative Spaces
- **Workspace Organization** - Dedicated spaces for different creative projects
- **Content Management** - Organize music, artwork, and videos by project
- **Privacy Controls** - Public and private workspace options
- **Collaboration Ready** - Built for team collaboration

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15.4.7](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [TanStack Query](https://tanstack.com/query/)

### Backend & Infrastructure
- **API**: [tRPC](https://trpc.io/) for type-safe APIs
- **Database**: [Supabase](https://supabase.com/)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage (R2)
- **Deployment**: [Vercel](https://vercel.com/)

### AI Integration
- **Music Generation**: ElevenLabs API
- **Artwork Generation**: Fal.ai API
- **Video Processing**: AI-powered video tools

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ ([Download here](https://nodejs.org/))
- npm or bun
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/botnetai/lofi-studio.git
   cd lofi-studio/web
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # AI APIs
   FAL_KEY=your_fal_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key

   # Other
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   bun dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
web/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── artwork/        # Artwork generation page
│   │   ├── music/          # Music generation page
│   │   ├── spaces/         # Space management pages
│   │   ├── video/          # Video production page
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # Reusable UI components
│   ├── lib/               # Utility functions and configurations
│   └── server/            # Server-side code (API, database, etc.)
├── public/                # Static assets
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

## 🎯 Usage

### Creating Your First Track

1. **Navigate to Music Studio**
   - Click on "Music" in the navigation
   - Or go directly to `/music`

2. **Set Up Your Track**
   - Choose a workspace for your track
   - Give your track a title
   - Select a music style
   - Describe what you want in the prompt

3. **Generate & Monitor**
   - Click "Generate Music"
   - Watch the progress in real-time
   - Download your completed track

### Managing Creative Spaces

1. **Create a New Space**
   - Go to "Spaces" → "Create New Space"
   - Give your space a name
   - Set privacy preferences

2. **Organize Content**
   - Each space keeps your music, artwork, and videos organized
   - Manage space settings and permissions
   - Share spaces with collaborators

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect your GitHub repository to Vercel**
2. **Configure environment variables** in Vercel dashboard
3. **Deploy** - Vercel will handle the build process automatically

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### Code Quality

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Next.js** built-in optimizations

### Database Schema

The application uses Supabase with the following main tables:
- `users` - User accounts and profiles
- `spaces` - Creative workspaces
- `songs` - Generated music tracks
- `artworks` - Generated artwork
- `videos` - Generated videos

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Test your changes thoroughly
- Update documentation as needed
- Ensure accessibility standards are met

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **AI Providers**: ElevenLabs, Fal.ai for amazing AI capabilities
- **Design Inspiration**: Modern creative platforms and AI tools
- **Open Source**: Built with amazing open-source tools and libraries

## 📞 Support

- **Documentation**: [docs.lofistudio.ai](https://docs.lofistudio.ai)
- **Issues**: [GitHub Issues](https://github.com/botnetai/lofi-studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/botnetai/lofi-studio/discussions)
- **Email**: support@lofistudio.ai

## 🌟 Roadmap

- [ ] **Advanced AI Features** - More sophisticated generation options
- [ ] **Collaboration Tools** - Real-time collaboration features
- [ ] **Mobile App** - Native mobile applications
- [ ] **Plugin System** - Extensible architecture for custom tools
- [ ] **Enterprise Features** - Advanced team management and analytics

---

**Built with ❤️ by the Lofi Studio team**

*Transforming creative workflows with the power of AI*