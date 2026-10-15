'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Copy, Check } from 'lucide-react'
import type { Video } from '@/types'

interface CopyLinkProps {
  video: Video
}

export function CopyLink({ video }: CopyLinkProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-2"
      aria-label="Copy video link"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-500" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span>Share</span>
        </>
      )}
    </Button>
  )
}