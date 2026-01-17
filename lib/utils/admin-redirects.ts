import { redirect } from 'next/navigation'

export function redirectToDugsiTab(tab: string): never {
  redirect(`/admin/dugsi?tab=${tab}`)
}

export function redirectToMahadDashboard(): never {
  redirect('/admin/mahad')
}
