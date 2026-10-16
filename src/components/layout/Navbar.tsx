'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Menu,
  X,
  Search,
  Plus,
  Bell,
  Home,
  Compass,
  Video,
  User,
  LogOut,
  Upload,
  Settings,
  HelpCircle,
  ExternalLink,
  Radio,
  Shield,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

function NavbarContent() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, isLoading, signOut } = useAuth()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync search input with URL search param
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setSearchQuery(q)
  }, [searchParams])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close sidebar on path change
  useEffect(() => {
    setIsSidebarOpen(false)
    setIsMobileSearchOpen(false)
  }, [pathname])

  // Hide common user navbar on /admin routes to avoid header crash
  if (pathname && pathname.startsWith('/admin')) {
    return null
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/')
    }
    setIsMobileSearchOpen(false)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    if (pathname === '/') {
      router.push('/')
    }
    searchInputRef.current?.focus()
  }

  const userDisplayName = profile?.display_name || user?.user_metadata?.display_name || 'Creator'
  const userUsername = profile?.username || user?.user_metadata?.username || 'user'
  const userAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url
  const profileUrl = user ? `/profile/${profile?.id || user.id}` : '/login'

  return (
    <>
      {/* Top Header Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-[#272727] flex items-center px-2.5 sm:px-4 justify-between select-none">
        {/* Left Section: Menu Toggle & Brand Logo */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* YouTube-Style Logo */}
          <Link href="/" className="flex items-center gap-1.5 focus:outline-none group shrink-0" aria-label="StreamFlow Home">
            <div className="flex items-center justify-center w-7 h-5 sm:w-8 sm:h-6 bg-[#ff0000] rounded sm:rounded-lg shadow-sm transition-transform group-hover:scale-105 shrink-0">
              <div className="w-0 h-0 border-y-[3.5px] sm:border-y-[4px] border-y-transparent border-l-[7px] sm:border-l-[8px] border-l-white ml-0.5" />
            </div>
            <div className="flex items-center">
              <span className="font-bold text-base sm:text-xl tracking-tight text-white font-sans">
                Stream<span className="text-zinc-400 font-medium">Flow</span>
              </span>
              <span className="text-[8px] sm:text-[9px] font-semibold text-zinc-500 uppercase ml-0.5 sm:ml-1 tracking-wider">
                IN
              </span>
            </div>
          </Link>
        </div>

        {/* Center Section: YouTube Iconic Search Bar (Desktop) */}
        <div className="hidden md:flex items-center justify-center flex-1 max-w-2xl px-6">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full max-w-lg">
            <div className="relative flex items-center w-full">
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121212] text-white text-sm pl-4 pr-9 py-2 rounded-l-full border border-[#303030] focus:border-[#1c62b9] focus:outline-none focus:ring-1 focus:ring-[#1c62b9] placeholder-zinc-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 text-zinc-400 hover:text-white p-0.5"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="bg-[#222222] hover:bg-[#272727] text-zinc-300 hover:text-white px-6 py-2 rounded-r-full border border-l-0 border-[#303030] flex items-center justify-center transition-colors shrink-0"
              title="Search"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Right Section: Upload, Mobile Search Icon & User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
            aria-label="Open search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Upload Button */}
          {user ? (
            <Link
              href="/upload"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#272727] hover:bg-[#383838] text-white text-xs sm:text-sm font-medium rounded-full transition-colors"
              title="Upload video"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Link>
          ) : (
            <Link
              href="/login?redirect=/upload"
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#272727] hover:bg-[#383838] text-white text-xs sm:text-sm font-medium rounded-full transition-colors"
              title="Upload video"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create</span>
            </Link>
          )}

          {/* Go Live Button */}
          <Link
            href={user ? '/go-live' : '/login?redirect=/go-live'}
            className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 text-xs sm:text-sm font-semibold rounded-full transition-colors"
            title="Go live"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse text-red-500" />
            <span className="hidden sm:inline text-xs">Go Live</span>
          </Link>

          {/* User Coin Balance */}
          {user && (
            <Link
              href={profileUrl}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] sm:text-xs font-bold rounded-full transition-colors"
              title="Your Wallet Coins"
            >
              <span className="text-xs">🪙</span>
              <span className="font-mono">{profile?.coin_balance ?? 50}</span>
            </Link>
          )}

          {/* User Account / Profile */}
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-8 h-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/40 ring-1 ring-zinc-700 hover:ring-zinc-500 transition-all flex items-center justify-center"
                aria-label="Account menu"
                aria-expanded={isProfileDropdownOpen}
              >
                {userAvatar ? (
                  <img src={userAvatar} alt={userDisplayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-xs font-bold uppercase">
                    {userDisplayName.charAt(0)}
                  </div>
                )}
              </button>

              {/* YouTube Style Account Dropdown */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#282828] border border-[#3e3e3e] shadow-2xl py-2 z-50 animate-slide-up text-[#f1f1f1]">
                  {/* Account Header */}
                  <div className="flex items-start gap-3 px-4 py-3 border-b border-[#3e3e3e]">
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={userDisplayName}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-zinc-600 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9c27b0] to-[#e91e63] flex items-center justify-center text-white text-sm font-bold uppercase shrink-0">
                        {userDisplayName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-white">{userDisplayName}</p>
                      <p className="text-xs text-zinc-400 truncate">@{userUsername}</p>
                      <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                      <Link
                        href={profileUrl}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="text-xs text-[#3ea6ff] hover:underline font-medium inline-block mt-1.5"
                      >
                        View your channel
                      </Link>
                    </div>
                  </div>

                  {/* Wallet Coins Summary in Dropdown */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-[#3e3e3e] text-xs">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <span>🪙</span>
                      <span>Wallet Coins:</span>
                    </div>
                    <span className="font-bold text-amber-400 text-sm">{profile?.coin_balance ?? 50}</span>
                  </div>

                  {/* Navigation Links */}
                  <div className="py-1 text-sm">
                    <Link
                      href={profileUrl}
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#383838] transition-colors"
                    >
                      <User className="h-5 w-5 text-zinc-400" />
                      <span>Your Channel</span>
                    </Link>

                    <Link
                      href="/my-videos"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#383838] transition-colors"
                    >
                      <Video className="h-5 w-5 text-zinc-400" />
                      <span>StreamFlow Studio (My Videos)</span>
                    </Link>

                    <Link
                      href="/upload"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#383838] transition-colors"
                    >
                      <Upload className="h-5 w-5 text-zinc-400" />
                      <span>Upload Video</span>
                    </Link>

                    <Link
                      href="/go-live"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#383838] transition-colors text-red-400"
                    >
                      <Radio className="h-5 w-5 text-red-500" />
                      <span>Go Live Studio</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-[#3e3e3e] pt-1">
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false)
                        signOut()
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#f1f1f1] hover:bg-[#383838] transition-colors text-left"
                    >
                      <LogOut className="h-5 w-5 text-zinc-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* YouTube Classic "Sign in" Pill Button */
            <Link
              href="/login"
              className="flex items-center gap-2 px-3 py-1.5 border border-[#3ea6ff]/40 text-[#3ea6ff] hover:bg-[#3ea6ff]/10 text-sm font-semibold rounded-full transition-colors"
            >
              <User className="h-4 w-4" />
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Search Overlay Bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0f0f0f] border-b border-[#272727] flex items-center px-2.5 gap-2 shadow-2xl animate-slide-down">
          <button
            onClick={() => setIsMobileSearchOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Back"
          >
            <X className="h-5 w-5" />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center">
            <div className="relative flex-1">
              <input
                autoFocus
                type="search"
                placeholder="Search StreamFlow..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161616] text-white text-xs pl-3.5 pr-8 py-2 rounded-l-full border border-[#303030] focus:border-[#1c62b9] focus:outline-none placeholder-zinc-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="bg-[#272727] hover:bg-[#333333] px-4 py-2 rounded-r-full border border-l-0 border-[#303030] text-zinc-300 hover:text-white shrink-0"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* YouTube-Style Collapsible Sidebar Drawer */}
      {isSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside className="fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-[#272727] flex flex-col p-3 animate-slide-up shadow-2xl">
            {/* Drawer Header with Logo & Close */}
            <div className="flex items-center gap-3 px-2 h-11 mb-2">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-1.5">
                <div className="flex items-center justify-center w-8 h-6 bg-[#ff0000] rounded-lg shadow-sm">
                  <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
                </div>
                <span className="font-bold text-lg tracking-tighter text-white font-sans">
                  Stream<span className="text-zinc-400 font-medium">Flow</span>
                </span>
              </Link>
            </div>

            {/* Navigation List */}
            <div className="flex-1 overflow-y-auto space-y-1 py-2 text-sm text-[#f1f1f1]">
              <Link
                href="/"
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                  pathname === '/' ? 'bg-[#272727] text-white font-semibold' : 'hover:bg-[#272727]'
                }`}
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </Link>

              <Link
                href="/?q=trending"
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium hover:bg-[#272727] transition-colors"
              >
                <Compass className="h-5 w-5" />
                <span>Explore</span>
              </Link>

              <div className="my-2 border-t border-[#272727]" />

              <div className="px-3 py-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                You
              </div>

              {user ? (
                <>
                  <Link
                    href={profileUrl}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                      pathname.startsWith('/profile') ? 'bg-[#272727] text-white font-semibold' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <User className="h-5 w-5" />
                    <span>Your Channel</span>
                  </Link>

                  <Link
                    href="/my-videos"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                      pathname === '/my-videos' ? 'bg-[#272727] text-white font-semibold' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <Video className="h-5 w-5" />
                    <span>My Videos</span>
                  </Link>

                  <Link
                    href="/upload"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                      pathname === '/upload' ? 'bg-[#272727] text-white font-semibold' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <Upload className="h-5 w-5" />
                    <span>Upload Video</span>
                  </Link>

                  <Link
                    href="/go-live"
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium transition-colors ${
                      pathname === '/go-live' ? 'bg-[#272727] text-white font-semibold' : 'hover:bg-[#272727]'
                    }`}
                  >
                    <Radio className="h-5 w-5 text-red-500" />
                    <span>Go Live Studio</span>
                  </Link>

                  <div className="my-2 border-t border-[#272727]" />

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl font-medium text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                  >
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <div className="p-3 bg-[#1f1f1f] rounded-2xl border border-[#272727] space-y-3">
                  <p className="text-xs text-zinc-400">
                    Sign in to like videos, comment, and upload your own content.
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setIsSidebarOpen(false)}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 border border-[#3ea6ff]/40 text-[#3ea6ff] hover:bg-[#3ea6ff]/10 text-xs font-semibold rounded-full w-full"
                  >
                    <User className="h-4 w-4" />
                    <span>Sign in</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="pt-2 border-t border-[#272727] px-3 text-[11px] text-zinc-500 space-y-1">
              <p>© 2026 StreamFlow</p>
              <p>Simple YouTube-Style Platform</p>
            </div>
          </aside>
        </>
      )}

      {/* YouTube-Style Bottom Navigation for Mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 h-12 bg-[#0f0f0f] border-t border-[#272727] flex items-center justify-around">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center gap-0.5 w-14 ${
            pathname === '/' ? 'text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <button
          onClick={() => setIsMobileSearchOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 w-14 text-zinc-400 hover:text-white"
        >
          <Search className="h-5 w-5" />
          <span className="text-[10px] font-medium">Search</span>
        </button>

        <Link
          href={user ? '/upload' : '/login?redirect=/upload'}
          className="flex flex-col items-center justify-center -mt-3"
          aria-label="Upload"
        >
          <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-md">
            <Plus className="h-6 w-6" />
          </div>
        </Link>

        <Link
          href={user ? '/my-videos' : '/login?redirect=/my-videos'}
          className={`flex flex-col items-center justify-center gap-0.5 w-14 ${
            pathname === '/my-videos' ? 'text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Video className="h-5 w-5" />
          <span className="text-[10px] font-medium">Studio</span>
        </Link>

        <Link
          href={profileUrl}
          className={`flex flex-col items-center justify-center gap-0.5 w-14 ${
            pathname.startsWith('/profile') || pathname === '/login' ? 'text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {user && userAvatar ? (
            <img src={userAvatar} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <User className="h-5 w-5" />
          )}
          <span className="text-[10px] font-medium">{user ? 'You' : 'Sign in'}</span>
        </Link>
      </nav>
    </>
  )
}

export function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#0f0f0f] border-b border-[#272727] flex items-center px-4 justify-between" />
      }
    >
      <NavbarContent />
    </Suspense>
  )
}