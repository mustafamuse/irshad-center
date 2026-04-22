import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

interface MahadPublicShellProps {
  title: React.ReactNode
  description?: React.ReactNode
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

export function MahadPublicShell({
  title,
  description,
  headerExtra,
  children,
}: MahadPublicShellProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f8fafa',
        backgroundImage: `radial-gradient(circle at 1px 1px, #007078 1px, transparent 0)`,
        backgroundSize: '28px 28px',
        backgroundPosition: '0 0',
      }}
    >
      <div
        className="min-h-screen"
        style={{
          background:
            'linear-gradient(160deg, rgba(248,250,250,0.97) 0%, rgba(248,250,250,0.92) 50%, rgba(222,180,62,0.06) 100%)',
        }}
      >
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mb-8 flex items-center justify-between">
            <Button
              asChild
              variant="ghost"
              className="h-10 gap-2 rounded-xl text-sm text-[#007078] hover:bg-[#007078]/10"
            >
              <Link href="/mahad">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </Button>
            <div className="w-32">
              <Logo size="sm" className="w-full" />
            </div>
          </div>

          <div className="mx-auto max-w-2xl">
            <header className="mb-10 space-y-3 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-[#007078] sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mx-auto max-w-md text-base text-gray-500">
                  {description}
                </p>
              ) : null}
              {headerExtra}
            </header>
            <main>{children}</main>
          </div>
        </div>
      </div>
    </div>
  )
}
