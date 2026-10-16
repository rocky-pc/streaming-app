import { Suspense } from 'react'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { siteConfig } from '@/config/site'
import { PWAProvider } from './PWAProvider'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'StreamFlow - Watch and Share Videos',
    template: `%s | StreamFlow`,
  },
  description: 'A modern, responsive video streaming platform built with Next.js, Supabase, and Tailwind CSS.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: 'StreamFlow',
    title: 'StreamFlow - Watch and Share Videos',
    description: 'A modern, responsive video streaming platform built with Next.js, Supabase, and Tailwind CSS.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StreamFlow - Watch and Share Videos',
    description: 'A modern, responsive video streaming platform built with Next.js, Supabase, and Tailwind CSS.',
  },
  robots: 'index, follow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StreamFlow',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0f0f0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="mask-icon" href="/icons/icon.svg" color="#ff0000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="StreamFlow" />
        <meta name="theme-color" content="#0f0f0f" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0f0f0f] text-[#f1f1f1] selection:bg-[#ff0000]/30 selection:text-white">
        <PWAProvider>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={<div className="h-14 bg-[#0f0f0f] border-b border-[#272727]" />}>
                <Navbar />
              </Suspense>
              <main className="flex-1 pt-14 pb-14 sm:pb-0">{children}</main>
              <Footer />
            </ToastProvider>
          </AuthProvider>
        </PWAProvider>
      </body>
    </html>
  )
}