'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TopUpModal } from '@/components/wallet/TopUpModal'

export default function TopUpPage() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    setIsOpen(false)
    router.push('/')
  }

  return (
    <div className="min-h-[85vh] bg-[#0f0f0f] flex items-center justify-center p-4">
      <TopUpModal isOpen={isOpen} onClose={handleClose} onSuccess={() => router.push('/')} />
    </div>
  )
}
