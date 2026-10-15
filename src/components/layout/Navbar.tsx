'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { siteConfig } from '@/config/site'
import { Play } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2" aria-label={`${siteConfig.name} - Home`}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
              <Play className="h-5 w-5 text-white ml-1" />
            </div>
            <span className="text-xl font-bold text-white">{siteConfig.name}</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {siteConfig.navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'text-indigo-400'
                    : 'text-gray-300 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="md:hidden">
            <button className="text-gray-300 hover:text-white" aria-label="Menu">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}