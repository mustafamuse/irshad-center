import { Program } from '@prisma/client'

export const PROGRAM_LABELS: Record<Program, string> = {
  MAHAD_PROGRAM: 'Mahad',
  DUGSI_PROGRAM: 'Dugsi',
  YOUTH_EVENTS: 'Youth',
  GENERAL_DONATION: 'Donation',
}

export const PROGRAM_DESCRIPTIONS: Record<Program, string> = {
  MAHAD_PROGRAM: 'Mahad Islamic Institute program',
  DUGSI_PROGRAM: 'Weekend Islamic school program',
  YOUTH_EVENTS: 'Youth activities and events',
  GENERAL_DONATION: 'General donations',
}

export const PROGRAM_BADGE_COLORS: Record<
  Program,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  MAHAD_PROGRAM: 'default',
  DUGSI_PROGRAM: 'secondary',
  YOUTH_EVENTS: 'outline',
  GENERAL_DONATION: 'outline',
}

export const TEACHER_PROGRAMS: Program[] = [
  'MAHAD_PROGRAM',
  'DUGSI_PROGRAM',
  'YOUTH_EVENTS',
]
