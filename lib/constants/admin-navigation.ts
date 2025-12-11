export interface NavItem {
  title: string
  url: string
  items?: NavItem[]
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export const ADMIN_NAVIGATION: NavGroup[] = [
  {
    title: 'Programs',
    items: [
      { title: 'Dugsi', url: '/admin/dugsi' },
      { title: 'Mahad', url: '/admin/mahad' },
    ],
  },
  {
    title: 'People',
    items: [
      { title: 'People Lookup', url: '/admin/people/lookup' },
      { title: 'Multi-role People', url: '/admin/people/multi-role' },
      { title: 'Teachers', url: '/admin/teachers' },
    ],
  },
  {
    title: 'Financial',
    items: [
      { title: 'Payments', url: '/admin/payments' },
      { title: 'Link Subscriptions', url: '/admin/link-subscriptions' },
      { title: 'Profit Share', url: '/admin/profit-share' },
    ],
  },
  {
    title: 'Operations',
    items: [{ title: 'Attendance', url: '/admin/shared/attendance' }],
  },
  {
    title: 'Public Pages',
    items: [
      { title: 'Home', url: '/' },
      {
        title: 'Mahad',
        url: '/mahad',
        items: [
          { title: 'Landing', url: '/mahad' },
          { title: 'Register', url: '/mahad/register' },
          { title: 'Programs', url: '/mahad/programs' },
          { title: 'Scholarship', url: '/mahad/scholarship' },
          { title: 'Autopay', url: '/mahad/autopay' },
          { title: 'Payment FAQ', url: '/mahad/payment-faq' },
          { title: 'Privacy', url: '/mahad/privacy' },
          { title: 'Terms', url: '/mahad/terms' },
        ],
      },
      {
        title: 'Dugsi',
        url: '/dugsi',
        items: [
          { title: 'Landing', url: '/dugsi' },
          { title: 'Register', url: '/dugsi/register' },
        ],
      },
    ],
  },
]

export function isActiveRoute(pathname: string, url: string): boolean {
  if (url === '/') {
    return pathname === '/'
  }
  return pathname === url || pathname.startsWith(`${url}/`)
}
