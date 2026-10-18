import type { Metadata } from 'next'
import { GoLiveClient } from './GoLiveClient'

export const metadata: Metadata = {
  title: 'Go Live | StreamFlow Studio',
  description: 'Broadcast high-definition video live to your viewers with StreamFlow and LiveKit Cloud.',
}

export default function GoLivePage() {
  return <GoLiveClient />
}
