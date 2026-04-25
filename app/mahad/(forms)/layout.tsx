import { AppErrorBoundary } from '@/components/error-boundary'

import { MahadPublicShellFrame } from '../_components/mahad-public-shell-frame'

export default function MahadFormsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppErrorBoundary context="Mahad public flow" variant="inline">
      <MahadPublicShellFrame>{children}</MahadPublicShellFrame>
    </AppErrorBoundary>
  )
}
