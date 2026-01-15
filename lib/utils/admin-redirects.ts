import { redirect } from 'next/navigation'

/**
 * Redirects to Dugsi admin dashboard with specified tab
 * @param tab - The tab to navigate to ('families', 'teachers', 'classes', 'attendance')
 * @throws Never returns - always redirects
 */
export function redirectToDugsiTab(tab: string): never {
  redirect(`/admin/dugsi?tab=${tab}`)
}

/**
 * Redirects to Mahad admin dashboard
 * @throws Never returns - always redirects
 */
export function redirectToMahadDashboard(): never {
  redirect('/admin/mahad')
}
