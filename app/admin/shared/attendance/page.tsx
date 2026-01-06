import { permanentRedirect } from 'next/navigation'

export default function SharedAttendanceRedirect() {
  permanentRedirect('/admin/dugsi/attendance')
}
