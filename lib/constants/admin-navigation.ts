import { isFeatureEnabled } from '@/lib/feature-flags'

export interface NavItem {
  title: string
  url: string
  items?: NavItem[]
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

const DUGSI_NAV_LEGACY: NavItem[] = [
  { title: 'Dashboard', url: '/admin/dugsi' },
  { title: 'Classes', url: '/admin/dugsi/classes' },
  { title: 'Teachers', url: '/admin/dugsi/teachers' },
  { title: 'Attendance', url: '/admin/dugsi/attendance' },
]

const DUGSI_NAV_CONSOLIDATED: NavItem[] = [
  { title: 'Dashboard', url: '/admin/dugsi' },
]

const MAHAD_NAV_LEGACY: NavItem[] = [
  { title: 'Dashboard', url: '/admin/mahad' },
  { title: 'Payments', url: '/admin/mahad/payments' },
]

const MAHAD_NAV_CONSOLIDATED: NavItem[] = [
  { title: 'Dashboard', url: '/admin/mahad' },
]

function getDugsiNav(): NavItem[] {
  return isFeatureEnabled('consolidatedAdminUI')
    ? DUGSI_NAV_CONSOLIDATED
    : DUGSI_NAV_LEGACY
}

function getMahadNav(): NavItem[] {
  return isFeatureEnabled('consolidatedAdminUI')
    ? MAHAD_NAV_CONSOLIDATED
    : MAHAD_NAV_LEGACY
}

export const ADMIN_NAVIGATION: NavGroup[] = [
  {
    title: 'Dugsi',
    items: getDugsiNav(),
  },
  {
    title: 'Mahad',
    items: getMahadNav(),
  },
  {
    title: 'Utilities',
    items: [
      { title: 'People Lookup', url: '/admin/people/lookup' },
      { title: 'Multi-role People', url: '/admin/people/multi-role' },
      { title: 'Link Subscriptions', url: '/admin/link-subscriptions' },
    ],
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
          { title: 'Teacher Check-in', url: '/teacher/checkin' },
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
