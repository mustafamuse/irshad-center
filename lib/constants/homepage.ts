export const IRSHAD_CENTER = {
  name: 'Irshad Islamic Center',
  tagline: 'Nurturing Faith Through Knowledge',
  mission:
    'Dedicated to providing authentic Islamic education rooted in the Quran and Sunnah, empowering our community with knowledge that transforms hearts and minds.',
  address: {
    street: '6520 Edenvale Blvd #110',
    city: 'Eden Prairie',
    state: 'MN',
    zip: '55346',
  },
  phone: '(952) 681-7785',
  email: 'info@irshadcenter.com',
  coordinates: { lat: 44.8547, lng: -93.4708 },
  googleMapsUrl:
    'https://www.google.com/maps/search/?api=1&query=6520+Edenvale+Blvd+%23110+Eden+Prairie+MN+55346',
  donationUrl: '',
  social: {
    instagram: 'https://www.instagram.com/irshadislamiccenter/',
    facebook: '',
  },
}

export const PROGRAMS = {
  mahad: {
    name: 'Irshād Māhad',
    subtitle: 'Islamic Studies Program',
    description: 'Comprehensive Islamic sciences curriculum',
    ageRange: 'Ages 16+',
    schedule: 'Weekend Evenings, 6:00 - 8:30 PM',
    href: '/mahad',
    status: 'Available Now',
  },
  dugsi: {
    name: 'Irshād Dugsi',
    subtitle: 'Youth Islamic Learning Program',
    description: 'Quran memorization & Islamic fundamentals',
    ageRange: 'Ages 5-15',
    schedule: 'Sat/Sun: 9AM-12PM & 2:30-5PM',
    href: '/dugsi/register',
    status: 'Registration Open',
  },
}

export const COMMUNITY_STATS = {
  students: { value: '276+', label: 'Students Enrolled' },
  graduates: { value: '20+', label: 'Māhad Graduates' },
  classes: { value: '6+', label: 'Weekly Classes' },
  halaqah: { value: 'Weekly', label: 'Halaqah Series' },
}

export const JUMMAH_TIMES = {
  firstPrayer: '12:00 PM',
  secondPrayer: '1:00 PM',
}

export const FRIDAY_YOUTH = {
  time: '7:30 PM',
  activities: ['Halaqa', 'Basketball', 'Badminton'],
}

export const IQAMAH_OFFSETS: Record<string, string> = {
  fajr: '+15 min',
  dhuhr: '+10 min',
  asr: '+10 min',
  maghrib: '+5 min',
  isha: '+10 min',
}

export type AnnouncementType = 'info' | 'warning' | 'success'

export interface Announcement {
  id: string
  text: string
  type: AnnouncementType
  active: boolean
}

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'open-house-jan-2025',
    text: 'Join us for Open House on Saturday, January 25th! Meet our teachers and learn about our programs.',
    type: 'info',
    active: true,
  },
]
