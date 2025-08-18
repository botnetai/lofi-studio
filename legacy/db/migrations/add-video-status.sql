-- Add status column to videos table
ALTER TABLE videos ADD COLUMN status TEXT DEFAULT 'completed';

-- Update existing videos to have 'completed' status
UPDATE videos SET status = 'completed' WHERE status IS NULL;

-- Create index for better performance when querying by status
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);