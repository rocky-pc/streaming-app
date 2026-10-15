'use client'

import { useState, useEffect } from 'react'
import { siteConfig } from '@/config/site'

export function Footer() {
  const [year, setYear] = useState(2024)

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <footer className="border-t border-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
        <p>&copy; {year} {siteConfig.name}. All rights reserved.</p>
      </div>
    </footer>
  )
}