import { permanentRedirect } from 'next/navigation'

export default function AttendanceRedirect() {
  permanentRedirect('/admin/shared/attendance')
}
