'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { siteConfig } from '@/config/site'
import {
  Play,
  Menu,
  X,
  Search,
  Upload,
  Home,
  User as UserIcon,
  Video,
  LogOut,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { usePWA } from '@/app/PWAProvider'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, isLoading, signOut } = useAuth()
  const { isInstallable, install, isOnline } = usePWA()

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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

  useEffect(() => {
    if (isInstallable && !isOnline) {
      const timer = setTimeout(() => setShowInstallBanner(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, isOnline])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/')
    }
  }

  const userDisplayName = profile?.display_name || user?.user_metadata?.display_name || 'Creator'
  const userUsername = profile?.username || user?.user_metadata?.username || 'user'
  const userAvatar = profile?.avatar_url || user?.user_metadata?.avatar_url

  return (
    <>
      {/* Install Banner */}
      {showInstallBanner && !isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700 px-4 py-2 animate-slide-down">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-amber-100">
              <span className="text-amber-300">💡</span>
              <span>Install {siteConfig.name} for offline access</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={install}
                className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-amber-200 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-200',
          'bg-gray-950/85 backdrop-blur-md border-b border-gray-800/80',
          isScrolled && 'shadow-lg bg-gray-950/95'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Home">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md shadow-indigo-600/30">
                  <Play className="h-5 w-5 text-white ml-0.5 fill-current" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent hidden sm:inline-block">
                  {siteConfig.name}
                </span>
              </Link>

              {/* Navigation Links for desktop */}
              <div className="hidden lg:flex items-center gap-1">
                <Link
                  href="/"
                  className={cn(
                    'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === '/'
                      ? 'bg-gray-800/90 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-850'
                  )}
                >
                  Home
                </Link>
                {user && (
                  <Link
                    href="/my-videos"
                    className={cn(
                      'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                      pathname === '/my-videos'
                        ? 'bg-gray-800/90 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-850'
                    )}
                  >
                    My Videos
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-auto">
              <form onSubmit={handleSearchSubmit} className="w-full relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search videos by title or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-gray-900 border border-gray-700/80 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      router.push('/')
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
            </div>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-3">
              {isLoading ? (
                <div className="h-9 w-24 bg-gray-800 animate-pulse rounded-lg" />
              ) : user ? (
                <>
                  <Link
                    href="/upload"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-md shadow-indigo-600/20"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload</span>
                  </Link>

                  {/* User Profile Menu */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-800 transition-colors border border-gray-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      aria-label="User menu"
                      aria-expanded={isProfileDropdownOpen}
                    >
                      {userAvatar ? (
                        <img
                          src={userAvatar}
                          alt={userDisplayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold uppercase">
                          {userDisplayName.charAt(0)}
                        </div>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400 mr-1" />
                    </button>

                    {/* Dropdown Card */}
                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-gray-900 border border-gray-800 shadow-2xl py-2 z-50 animate-slide-up">
                        <div className="px-4 py-3 border-b border-gray-800">
                          <p className="text-sm font-semibold text-white truncate">{userDisplayName}</p>
                          <p className="text-xs text-gray-400 truncate">@{userUsername}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                        </div>

                        <div className="py-1">
                          <Link
                            href={`/profile/${profile?.id || user.id}`}
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800/80 transition-colors"
                          >
                            <UserIcon className="h-4 w-4 text-gray-400" />
                            <span>Your Profile</span>
                          </Link>

                          <Link
                            href="/my-videos"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800/80 transition-colors"
                          >
                            <Video className="h-4 w-4 text-gray-400" />
                            <span>My Videos</span>
                          </Link>

                          <Link
                            href="/upload"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800/80 transition-colors"
                          >
                            <Upload className="h-4 w-4 text-gray-400" />
                            <span>Upload Video</span>
                          </Link>
                        </div>

                        <div className="border-t border-gray-800 pt-1 mt-1">
                          <button
                            onClick={() => {
                              setIsProfileDropdownOpen(false)
                              signOut()
                            }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-3.5 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-md shadow-indigo-600/20"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="sm:hidden flex items-center gap-2">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Toggle navigation menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMenuOpen && (
          <div className="sm:hidden border-b border-gray-800 bg-gray-950 px-4 py-4 space-y-3 animate-slide-down">
            {/* Mobile search inside menu */}
            <form onSubmit={handleSearchSubmit} className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </form>

            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                pathname === '/' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-900'
              )}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>

            {user ? (
              <>
                <Link
                  href="/upload"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-400 bg-indigo-950/40 border border-indigo-800/40"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Video</span>
                </Link>

                <Link
                  href="/my-videos"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                    pathname === '/my-videos' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-900'
                  )}
                >
                  <Video className="h-4 w-4" />
                  <span>My Videos</span>
                </Link>

                <Link
                  href={`/profile/${profile?.id || user.id}`}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
                    pathname.startsWith('/profile') ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-900'
                  )}
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Profile (@{userUsername})</span>
                </Link>

                <div className="pt-2 border-t border-gray-800">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-2.5 text-center text-sm font-medium text-gray-200 bg-gray-900 border border-gray-700 rounded-lg hover:bg-gray-800"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setIsMenuOpen(false)}
                  className="block w-full py-2.5 text-center text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-gray-800/80">
        <div className="grid grid-cols-4 h-14">
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1',
              pathname === '/' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
            )}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <Link
            href={user ? '/upload' : '/login?redirect=/upload'}
            className={cn(
              'flex flex-col items-center justify-center gap-1',
              pathname === '/upload' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center -mt-2 shadow-lg shadow-indigo-600/40 text-white">
              <Upload className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-medium">Upload</span>
          </Link>

          <Link
            href={user ? '/my-videos' : '/login?redirect=/my-videos'}
            className={cn(
              'flex flex-col items-center justify-center gap-1',
              pathname === '/my-videos' ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
            )}
          >
            <Video className="h-5 w-5" />
            <span className="text-[10px] font-medium">My Videos</span>
          </Link>

          <Link
            href={user ? `/profile/${profile?.id || user.id}` : '/login'}
            className={cn(
              'flex flex-col items-center justify-center gap-1',
              pathname.startsWith('/profile') || pathname === '/login'
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <UserIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{user ? 'Profile' : 'Sign In'}</span>
          </Link>
        </div>
      </nav>
    </>
  )
}