'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SearchBar } from '@/components/video/SearchBar'

export function SearchBarClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const initialQuery = searchParams.get('q') || ''
  const [searchQuery, setSearchQuery] = useState(initialQuery)

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '')
  }, [searchParams])

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }
    router.push(`${pathname}?${params.toString()}`)
    setSearchQuery(query)
  }

  return (
    <SearchBar
      value={searchQuery}
      onChange={setSearchQuery}
      onSearch={handleSearch}
      placeholder="Search videos by title..."
    />
  )
}