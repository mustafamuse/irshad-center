import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

interface MahadPublicShellFrameProps {
  children: React.ReactNode
}

export function MahadPublicShellFrame({
  children,
}: MahadPublicShellFrameProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: '#f8fafa',
        backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--brand)) 1px, transparent 0)`,
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
              className="h-10 gap-2 rounded-xl text-sm text-brand hover:bg-brand/10"
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

          <div className="mx-auto max-w-2xl">{children}</div>
        </div>
      </div>
    </div>
  )
}
