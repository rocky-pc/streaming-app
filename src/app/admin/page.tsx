import type { Metadata } from 'next'
import AdminPortalClient from './AdminPortalClient'

export const metadata: Metadata = {
  title: 'StreamFlow Administration | Serverless Stream Flow Management',
  description: 'Control streaming, uploads, live chats, and stream flow without an external backend.',
}

export default function AdminPage() {
  return <AdminPortalClient />
}
