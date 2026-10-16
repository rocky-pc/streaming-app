'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { siteConfig } from '@/config/site'

export function Footer() {
  const pathname = usePathname()
  const [year, setYear] = useState(2025)

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  if (
    pathname &&
    (pathname.startsWith('/video/') ||
      pathname.startsWith('/live/') ||
      pathname === '/go-live' ||
      pathname.startsWith('/admin'))
  ) {
    return null
  }

  return (
    <footer className="border-t border-[#272727] py-6 px-6 bg-[#0f0f0f] hidden sm:block">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-[#aaaaaa] gap-3">
        <p>&copy; {year} {siteConfig.name}. All rights reserved.</p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-zinc-400">
          <span className="hover:text-white transition-colors cursor-pointer">About</span>
          <span className="hover:text-white transition-colors cursor-pointer">Press</span>
          <span className="hover:text-white transition-colors cursor-pointer">Copyright</span>
          <span className="hover:text-white transition-colors cursor-pointer">Contact us</span>
          <span className="hover:text-white transition-colors cursor-pointer">Creators</span>
          <span className="hover:text-white transition-colors cursor-pointer">Terms</span>
          <span className="hover:text-white transition-colors cursor-pointer">Privacy</span>
          <span className="hover:text-white transition-colors cursor-pointer">Policy & Safety</span>
        </div>
      </div>
    </footer>
  )
}