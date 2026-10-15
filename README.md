# StreamHub - Modern Video Streaming Platform

A clean, modern video streaming website built with Next.js 15, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🎬 **Video Playback** - Full-featured HTML5 video player with keyboard shortcuts
- 📤 **Video Upload** - Simple upload interface with progress tracking
- 🔍 **Search & Discovery** - Real-time search with pagination
- 💾 **Supabase Integration** - PostgreSQL database + Storage for videos/thumbnails
- 🌙 **Dark Theme** - Modern, premium dark UI with smooth animations
- 📱 **Responsive** - Works on mobile, tablet, and desktop
- ⌨️ **Keyboard Shortcuts** - Space/K (play/pause), Arrow keys (seek/volume), F (fullscreen), M (mute), 0-9 (seek %), >/< (speed)
- 🔗 **Share & Resume** - Copy link, remembers playback position

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Icons**: Lucide React
- **Utilities**: clsx, tailwind-merge

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm
- Supabase account

### 1. Clone & Install

```bash
cd streaming-app
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration from `supabase/migrations/20240101000000_initial_schema.sql`
3. Go to **Storage** and create two buckets:
   - `videos` (public, 2GB limit, video types)
   - `thumbnails` (public, 5MB limit, image types)
4. Set up Storage policies (included in migration)

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1/s3
NEXT_PUBLIC_SUPABASE_BUCKET_VIDEOS=videos
NEXT_PUBLIC_SUPABASE_BUCKET_THUMBNAILS=thumbnails
```

**Important**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code. It's only used in API routes.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── upload/route.ts      # Video upload API
│   │   └── videos/route.ts      # Video listing API
│   ├── upload/page.tsx          # Upload page
│   ├── video/[id]/
│   │   ├── page.tsx             # Video page (server)
│   │   ├── VideoPlayerClient.tsx # Video player (client)
│   │   └── CopyLink.tsx         # Share button
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Home page
├── components/
│   ├── layout/Navbar.tsx        # Navigation bar
│   ├── ui/                      # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Textarea.tsx
│   │   ├── Card.tsx
│   │   └── Skeleton.tsx
│   └── video/                   # Video-specific components
│       ├── VideoPlayer.tsx      # Main video player
│       ├── VideoCard.tsx        # Video card for grid
│       ├── VideoGrid.tsx        # Responsive video grid
│       └── SearchBar.tsx        # Search component
├── config/
│   └── site.ts                  # Site configuration
├── hooks/                       # Custom React hooks
├── lib/
│   ├── api.ts                   # Database queries
│   ├── supabase.ts              # Supabase client
│   ├── upload.ts                # Upload utilities
│   └── utils.ts                 # Helper functions
└── types/
    ├── index.ts                 # TypeScript types
    └── database.ts              # Supabase database types
supabase/
└── migrations/
    └── 20240101000000_initial_schema.sql
```

## Customization

### Site Configuration

Edit `src/config/site.ts` to customize:

```typescript
export const siteConfig = {
  name: 'StreamHub',
  description: 'Modern video streaming platform',
  url: 'http://localhost:3000',
  logo: { text: 'StreamHub', icon: 'Play' },
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'Upload', href: '/upload' },
  ],
  theme: {
    primary: '#6366f1',
    background: '#030712',
    surface: '#111827',
    border: '#1f2937',
  },
  video: {
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'application/x-mpegURL'],
    thumbnailTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxThumbnailSize: 5 * 1024 * 1024, // 5MB
  },
  pagination: { videosPerPage: 20 },
}
```

### Styling

- Colors: Edit `theme` in `siteConfig` or Tailwind classes
- Global styles: `src/app/globals.css`
- Component styles: Individual component files

## Keyboard Shortcuts (Video Player)

| Key | Action |
|-----|--------|
| Space / K | Play/Pause |
| ← / → | Seek -10s / +10s |
| ↑ / ↓ | Volume +10% / -10% |
| M | Mute/Unmute |
| F | Fullscreen |
| 0-9 | Seek to 0-90% |
| > / . | Speed +0.25x |
| < / , | Speed -0.25x |
| Home | Seek to start |
| End | Seek to end |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Database Schema

```sql
-- Videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  duration DOUBLE PRECISION,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_videos_title ON videos USING GIN (to_tsvector('english', title));
CREATE INDEX idx_videos_created_at ON videos (created_at DESC);

-- RLS Policies (public read, service role write)
```

## Security

- Row Level Security (RLS) enabled on all tables
- Public read access for videos
- Service role required for writes (upload API)
- Storage policies restrict bucket access
- No secrets exposed to client

## Performance

- Lazy loading for thumbnails
- Pagination (20 videos per page)
- Skeleton loaders during fetch
- Efficient video playback (native HTML5)
- Resumable uploads for large files
- Optimized Supabase queries

## License

MIT License - feel free to use for personal or commercial projects.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with ❤️ using Next.js, Supabase, and Tailwind CSS