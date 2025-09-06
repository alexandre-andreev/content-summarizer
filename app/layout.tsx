import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { Header } from '@/components/header'
import { Toaster } from '@/components/ui/sonner'
import { ConnectionMonitor } from '@/components/connection-monitor'
import './globals.css'

export const metadata: Metadata = {
  title: 'Content Summarizer',
  description: 'AI-powered YouTube video summarization tool',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          <ConnectionMonitor />
          <Header />
          {children}
          <Toaster />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
