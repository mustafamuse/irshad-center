import { MahadPublicShellFrame } from '../_components/mahad-public-shell-frame'

export default function MahadFormsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MahadPublicShellFrame>{children}</MahadPublicShellFrame>
}
