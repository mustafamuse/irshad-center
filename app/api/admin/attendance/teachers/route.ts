import { NextResponse } from 'next/server'

import { assertAdmin } from '@/lib/auth/assert-admin'
import { getDugsiTeachersForDropdown } from '@/lib/db/queries/teacher-checkin'
import type { TeacherDropdownItemDto } from '@/lib/features/attendance/contracts'

export async function GET() {
  try {
    await assertAdmin('admin-attendance-teachers')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const teachers = await getDugsiTeachersForDropdown()
    const dto: TeacherDropdownItemDto[] = teachers.map((t) => ({
      id: t.id,
      name: t.name,
    }))
    return NextResponse.json(dto)
  } catch {
    return NextResponse.json(
      { error: 'Failed to load teachers' },
      { status: 500 }
    )
  }
}
