# StreamFlow - Simple YouTube-Style Video Streaming Platform

A complete, responsive, and modern video streaming website built with **Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase Auth, Supabase PostgreSQL, and Supabase Storage**.

---

## 🌟 Key Features

### 1. Authentication & User Profiles
- **Supabase Auth**: Email & password authentication with secure session persistence using `@supabase/ssr`.
- **Pages**:
  - Sign Up (`/signup`) with automatic username & profile generation via database triggers.
  - Login (`/login`) with redirect memory (e.g. redirecting back to `/upload` after signing in).
  - Forgot Password (`/forgot-password`) to request password recovery.
  - Reset Password (`/reset-password`) to update account password.
  - Sign Out (`/auth/signout`) with server-side cookie clearing.
- **Profile Page** (`/profile/[id]`): Displays channel avatar, display name, `@username`, bio, join date, and public videos. Includes an in-place profile editor for the account owner.
- **Profile Menu**: User avatar dropdown in the navigation bar with quick links to profile, My Videos, and Sign Out.

### 2. Home Page & Discovery
- **Public Video Grid**: Responsive grid displaying all public uploads sorted newest-to-oldest.
- **Video Cards**: Consistent 16:9 ratio thumbnails, duration badge, uploader avatar, uploader channel name, and relative timestamps.
- **Instant Search**: Search videos across both titles and descriptions with active filter badges.
- **Pagination**: "Load More" functionality with loading skeletons and empty states.
- **Guest Friendly**: Unauthenticated visitors can freely browse and watch all public videos without signing in.

### 3. My Videos (Creator Studio)
- **Dedicated Management Page** (`/my-videos`): Shows all uploads belonging exclusively to the logged-in user.
- **Visibility Badges**: Clearly distinguishes between Public, Unlisted, and Private videos.
- **Filter Tabs**: Filter user videos by All, Public, Unlisted, and Private.
- **Edit Modal**: Edit video title, description, visibility status, or upload a new thumbnail.
- **Delete Confirmation**: Deletes video record from the database and permanently purges files from Supabase Storage buckets to prevent orphaned files.

### 4. Video Upload & Storage
- **Protected Upload** (`/upload`): Requires login before allowing uploads.
- **Direct Storage Upload**: Uploads video and thumbnail files directly to Supabase Storage with authenticated JWT.
- **Progress & Validation**: File type validation (MP4, WebM, MOV), file size checks (up to 2 GB), and real-time progress indicators.
- **Automatic Metadata**: Extracts video duration automatically via HTML5 metadata.
- **Safe Rollback**: Cleans up uploaded storage files if database metadata insertion fails.
- **Secure Credentials**: Never exposes service-role keys in frontend client code.

### 5. Video Watch Page & HTML5 Player
- **Dedicated Watch Page** (`/video/[id]`):
  - Custom HTML5 player controls: play/pause, seek scrubber, volume/mute, playback speed selector (0.5x to 2x), and fullscreen toggle.
  - Keyboard shortcuts: `Space`/`k` (play/pause), `f` (fullscreen), `m` (mute), `Arrow Left`/`Right` (seek 5s), `Arrow Up`/`Down` (volume).
  - Remembers playback progress in localStorage.
  - Collapsible video description.
  - One-click share button with clipboard copying and toast notification.
  - "Up Next" sidebar featuring related public videos.

### 6. Visibility & Access Rules
- **Public**: Visible on the home page, searchable, and playable by anyone.
- **Unlisted**: Excluded from home page listings and search; accessible only by direct watch page share link.
- **Private**: Visible and playable ONLY by its owner. Enforced via Row Level Security (RLS) and server authorization. Private videos stream using signed URLs.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router with Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS
- **Authentication & Database**: Supabase (PostgreSQL + Auth + Storage)
- **SSR Client**: `@supabase/ssr`
- **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/rocky-pc/streaming-app.git
cd streaming-app
npm install
```

### 2. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Fill in your Supabase project credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-server-only
NEXT_PUBLIC_SUPABASE_BUCKET_VIDEOS=videos
NEXT_PUBLIC_SUPABASE_BUCKET_THUMBNAILS=thumbnails
```

### 3. Apply Supabase Database Migrations

Run the SQL migration in your Supabase SQL Editor:

1. Open `supabase/migrations/20261016000000_auth_profiles_visibility.sql`
2. Run it in your Supabase Dashboard SQL Editor (or via Supabase CLI `supabase db push`).

This sets up:
- `profiles` table linked to `auth.users(id)`
- Auto-profile trigger on user signup
- Video `visibility` column (`public`, `unlisted`, `private`)
- Row Level Security (RLS) policies for `videos`, `profiles`, and `storage.objects`
- Storage buckets: `videos` and `thumbnails`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── profile/route.ts      # Update profile details
│   │   ├── upload/route.ts       # Secure video metadata save
│   │   └── videos/[id]/route.ts  # Video edit (PATCH) & delete (DELETE)
│   ├── auth/
│   │   ├── callback/route.ts     # Auth code exchange
│   │   └── signout/route.ts      # Server signout
│   ├── forgot-password/page.tsx  # Forgot password page
│   ├── login/page.tsx            # Login page
│   ├── my-videos/page.tsx        # Creator studio / My Videos
│   ├── profile/[id]/page.tsx     # Channel / Profile page
│   ├── reset-password/page.tsx   # Reset password page
│   ├── signup/page.tsx           # Sign up page
│   ├── upload/page.tsx           # Video upload page
│   ├── video/[id]/page.tsx       # Watch video page
│   ├── HomePageClient.tsx        # Home feed client with search & pagination
│   ├── layout.tsx                # App layout with Auth & Toast providers
│   └── page.tsx                  # Home page server component
├── components/
│   ├── layout/Navbar.tsx         # Top nav with search, profile menu, and mobile nav
│   ├── ui/                       # Reusable UI components (Button, Input, Card, ConfirmDialog, etc.)
│   └── video/                    # VideoPlayer, VideoCard, VideoGrid, VideoGridSkeleton
├── context/
│   ├── AuthContext.tsx           # Supabase Auth provider & state
│   └── ToastContext.tsx          # Toast notification provider
├── lib/
│   ├── supabase/                 # Browser, server, and middleware Supabase clients
│   ├── api.ts                    # Universal data access functions
│   ├── supabase.ts               # Storage helpers and browser instance
│   └── utils.ts                  # Date and format utilities
├── middleware.ts                 # Next.js session refresh & route protection
└── types/                        # Database schema & application TypeScript types
```

---

## 🔒 Security & Privacy

- **Passwords**: Never stored or handled in application code; securely hashed and managed by Supabase Auth.
- **Row Level Security (RLS)**: Protects videos and profiles at the PostgreSQL level.
- **Private Video Isolation**: Non-owners cannot read private metadata or play private video streams.
- **Secret Protection**: Service-role keys are never bundled into client-side code.