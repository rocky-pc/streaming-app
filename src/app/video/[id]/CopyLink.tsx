'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Share2, Check } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import type { Video } from '@/types'

interface CopyLinkProps {
  video: Video
}

export function CopyLink({ video }: CopyLinkProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      setCopied(true)
      toast('Video link copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2500)
    } catch (error) {
      console.error('Failed to copy link:', error)
      toast('Failed to copy link.', 'error')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="gap-2 border-gray-700 bg-gray-800/80 text-gray-200 hover:text-white hover:bg-gray-700"
      aria-label="Share video"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-300">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 text-indigo-400" />
          <span>Share</span>
        </>
      )}
    </Button>
  )
}