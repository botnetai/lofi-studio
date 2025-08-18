import { json } from '@tanstack/start'
import { createAPIFileRoute } from '@tanstack/start/api'

export const APIRoute = createAPIFileRoute('/api/publishing-history')({
  // Get publishing history
  GET: async ({ context }) => {
    const env = context.env as any

    try {
      const history = await env.DB.prepare(`
        SELECT * FROM publishing_history 
        ORDER BY published_at DESC
        LIMIT 100
      `).all()

      return json(history.results || [])
    } catch (error) {
      console.error('Failed to fetch publishing history:', error)
      return json({ error: 'Failed to fetch publishing history' }, { status: 500 })
    }
  },

  // Add publishing history entry
  POST: async ({ request, context }) => {
    const env = context.env as any
    const body = await request.json()
    const { platform, album_id, status, metadata } = body

    try {
      const id = crypto.randomUUID()
      await env.DB.prepare(`
        INSERT INTO publishing_history (id, platform, album_id, status, metadata, published_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        platform,
        album_id,
        status || 'success',
        JSON.stringify(metadata || {})
      ).run()

      return json({ success: true, id })
    } catch (error: any) {
      console.error('Failed to add publishing history:', error)
      return json({ error: error.message || 'Failed to add history' }, { status: 500 })
    }
  }
})