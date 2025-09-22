import { BatchProvider } from '@/app/batches/_providers/batch-provider'
import { QueryProvider } from './_providers/query-provider'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <BatchProvider>{children}</BatchProvider>
    </QueryProvider>
  )
}
