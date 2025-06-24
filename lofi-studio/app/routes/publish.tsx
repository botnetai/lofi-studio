import { createFileRoute } from '@tanstack/react-router'
import { PublishTab } from '../components/PublishTab'

export const Route = createFileRoute('/publish')({
  component: PublishPage,
})

function PublishPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Publish & Distribute</h1>
        <p className="text-muted-foreground mt-2">
          Share your music on YouTube, TikTok, and music streaming platforms
        </p>
      </div>
      
      <PublishTab />
    </div>
  )
}