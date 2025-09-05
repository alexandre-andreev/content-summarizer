
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { LogIn, LogOut, UserPlus, LayoutDashboard } from 'lucide-react'

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <>
      {user ? (
        <>
        </>
      ) : (
        <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-50 w-full border-b">
          <div className="container mx-auto flex h-16 items-center justify-end px-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/auth/login')}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
            <Button onClick={() => router.push('/auth/register')}>
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </header>
      )}
    </>
  )
}
