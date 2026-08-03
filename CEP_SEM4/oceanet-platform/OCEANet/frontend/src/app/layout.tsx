import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import ClientComponents from '@/components/ClientComponents'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Nerexis | Environmental Intelligence Platform',
    template: '%s | Nerexis',
  },
  description: 'A public-facing AI platform for marine, climate, and ecosystem monitoring with live analytics and reporting workflows.',
  applicationName: 'Nerexis',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Nerexis',
    title: 'Nerexis | Environmental Intelligence Platform',
    description: 'Live marine and climate intelligence for monitoring, analytics, and reporting.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nerexis | Environmental Intelligence Platform',
    description: 'Live marine and climate intelligence for monitoring, analytics, and reporting.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111827',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
      </head>
      <body className={`${manrope.variable} bg-gradient-dark min-h-screen antialiased`}>
        {children}
        <ClientComponents />
      </body>
    </html>
  )
}
