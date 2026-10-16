import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getUserProfile, getUserPublicVideos } from '@/lib/api'
import { ProfileClient } from './ProfileClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const profile = await getUserProfile(id)

  if (!profile) {
    return { title: 'User Not Found' }
  }

  const name = profile.display_name || profile.username
  return {
    title: `${name} (@${profile.username})`,
    description: profile.bio || `Watch videos uploaded by ${name} on StreamFlow.`,
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { id } = await params
  const profile = await getUserProfile(id)

  if (!profile) {
    notFound()
  }

  const videos = await getUserPublicVideos(profile.id)

  return <ProfileClient profile={profile} initialVideos={videos} />
}
