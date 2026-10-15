'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  placeholder?: string
}

function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): T {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

export function SearchBar({ value, onChange, onSearch, placeholder = 'Search videos...' }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const debouncedSearchRef = useRef(
    debounce((query: string) => {
      onSearch(query)
    }, 300)
  )

  useEffect(() => {
    debouncedSearchRef.current(value)
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
  }

  const handleClear = () => {
    onChange('')
    onSearch('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(value)
    }
  }

  return (
    <div className={cn('relative w-full max-w-xl', isFocused && 'max-w-2xl')}>
      <label htmlFor="search" className="sr-only">
        Search videos
      </label>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-indigo-400" />
        <input
          id="search"
          type="search"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-12 pr-12 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-all duration-200',
            'text-sm sm:text-base'
          )}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}