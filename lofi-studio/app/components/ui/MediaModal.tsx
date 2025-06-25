import { useState, useEffect } from 'react'
import { X, Download, Info } from 'lucide-react'
import { Button } from './Button'

interface MediaModalProps {
  isOpen: boolean
  onClose: () => void
  media: {
    id: string
    url: string
    type: 'image' | 'video'
    prompt?: string
    metadata?: any
    created_at: string
  }
}

export function MediaModal({ isOpen, onClose, media }: MediaModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  
  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  const metadata = typeof media.metadata === 'string' 
    ? JSON.parse(media.metadata) 
    : media.metadata || {}
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {media.type === 'video' ? 'Video' : 'Image'} Details
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Media Content */}
        <div className="relative bg-gray-100 dark:bg-gray-800">
          {media.type === 'video' ? (
            <video
              controls
              autoPlay
              loop
              className="w-full max-h-[60vh] object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={media.url} type="video/mp4" />
            </video>
          ) : (
            <img 
              src={media.url} 
              alt={media.prompt || 'Generated image'} 
              className="w-full max-h-[60vh] object-contain"
            />
          )}
        </div>
        
        {/* Info Panel */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Prompt</h4>
              <p className="text-gray-900 dark:text-gray-100">
                {media.prompt || metadata.prompt || 'No prompt provided'}
              </p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Model</h4>
              <p className="text-gray-900 dark:text-gray-100">
                {metadata.model || 'Unknown'}
                {metadata.mode && ` (${metadata.mode})`}
              </p>
            </div>
            
            {metadata.duration && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duration</h4>
                <p className="text-gray-900 dark:text-gray-100">{metadata.duration} seconds</p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created</h4>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(media.created_at).toLocaleString()}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={media.url}
              download={`${media.type}-${media.id}.${media.type === 'video' ? 'mp4' : 'png'}`}
            >
              <Button variant="primary">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </a>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}