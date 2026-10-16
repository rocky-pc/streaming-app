'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { siteConfig } from '@/config/site'
import { Play, Menu, X, Search, Upload, Home, Users, Bell, LayoutGrid, ChevronDown } from 'lucide-react'
import { usePWA } from '@/app/PWAProvider'

export function Navbar() {
  const pathname = usePathname()
  const { isInstallable, install, isOnline } = usePWA()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isInstallable && !isOnline) {
      const timer = setTimeout(() => setShowInstallBanner(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [isInstallable, isOnline])

  const navigation = siteConfig.navigation

  return (
    <>
      {/* Install Banner */}
      {showInstallBanner && !isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 backdrop-blur-sm border-b border-amber-700 px-4 py-2 animate-slide-down">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-amber-100">
              <span className="text-amber-300">💡</span>
              <span>Install StreamFlow for offline access</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={install}
                className="px-3 py-1.5 text-sm font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors touch-target-sm"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-amber-200 hover:text-white touch-target-sm"
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
          'bg-black/80 backdrop-blur-md border-b border-gray-800',
          isScrolled && 'shadow-lg bg-black/95'
        )}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} - Home`}>
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
                <Play className="h-5 w-5 text-white ml-1" />
              </div>
              <span className="text-xl font-bold text-white hidden sm:block">{siteConfig.name}</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 touch-target',
                    pathname === item.href
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/upload"
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors touch-target flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn(
                  'p-2 rounded-lg transition-colors touch-target',
                  isMenuOpen ? 'bg-gray-800 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-800'
                )}
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          className={cn(
            'md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-black border-b border-gray-800',
            isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all touch-target',
                  pathname === item.href
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-800">
              <Link
                href="/upload"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-3 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 transition-colors touch-target"
              >
                <Upload className="h-5 w-5" />
                <span>Upload Video</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar (shown when menu closed) */}
        <div className={cn('md:hidden px-4 pb-4', isMenuOpen ? 'hidden' : 'block')}>
          <form role="search">
            <label htmlFor="mobile-search" className="sr-only">Search videos</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="mobile-search"
                type="search"
                placeholder="Search videos..."
                className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                autoComplete="off"
              />
            </div>
          </form>
        </div>
      </nav>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-gray-800 safe-area-inset-bottom">
        <div className="grid grid-cols-5">
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-3 touch-target',
              pathname === '/'
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-white'
            )}
            aria-label="Home"
          >
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-3 touch-target',
              pathname === '/'
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-white'
            )}
            aria-label="Explore"
          >
            <LayoutGrid className="h-6 w-6" />
            <span className="text-xs font-medium">Explore</span>
          </Link>
          <Link
            href="/upload"
            className="relative flex flex-col items-center justify-center gap-1 px-2 py-3 touch-target"
            aria-label="Upload"
          >
            <div className="relative">
              <Upload className="h-6 w-6 text-gray-400 hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">+</span>
              </span>
            </div>
            <span className="text-xs font-medium text-gray-400">Upload</span>
          </Link>
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-3 touch-target',
              'text-gray-400 hover:text-white'
            )}
            aria-label="Notifications"
          >
            <Bell className="h-6 w-6" />
            <span className="text-xs font-medium">Notifications</span>
          </Link>
          <Link
            href="/"
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-3 touch-target',
              'text-gray-400 hover:text-white'
            )}
            aria-label="Profile"
          >
            <Users className="h-6 w-6" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Backdrop for mobile menu */}
      {isMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}