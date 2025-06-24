import { createFileRoute } from '@tanstack/react-router'
import { GenerateMusic } from '../components/GenerateMusic'
import { MusicLibrary } from '../components/MusicLibrary'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Generate Lofi Music</h1>
        <p className="text-muted-foreground">
          Create AI-powered lofi beats with custom prompts and lyrics
        </p>
      </div>
      
      <GenerateMusic />
      
      <div className="mt-12">
        <MusicLibrary />
      </div>
    </div>
  )
}