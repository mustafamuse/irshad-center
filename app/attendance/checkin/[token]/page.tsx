import { prisma } from '@/lib/db'
import { verifyQRToken } from '@/lib/qr-token'

import { CheckInForm } from './check-in-form'

interface Props {
  params: Promise<{
    token: string
  }>
}

export default async function CheckInPage({ params }: Props) {
  const { token } = await params

  // Verify token server-side
  const tokenPayload = verifyQRToken(token)
  if (!tokenPayload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h1 className="mb-2 text-lg font-semibold text-red-800">
              Invalid QR Code
            </h1>
            <p className="text-red-600">
              This QR code has expired or is invalid. Please ask your teacher
              for a new one.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Get session and batch info
  const session = await prisma.attendanceSession.findUnique({
    where: { id: tokenPayload.sessionId },
    include: {
      batch: {
        include: {
          students: {
            select: {
              id: true,
              name: true,
              email: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      },
    },
  })

  if (!session || !session.allowSelfCheckIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <h1 className="mb-2 text-lg font-semibold text-yellow-800">
              Check-In Not Available
            </h1>
            <p className="text-yellow-700">
              Self check-in is not enabled for this session.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 pt-8">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Check In to Class
            </h1>
            <div className="text-sm text-gray-600">
              <p className="font-medium">{session.batch.name}</p>
              <p>{new Date(session.date).toLocaleDateString()}</p>
            </div>
          </div>

          <CheckInForm token={token} students={session.batch.students} />
        </div>
      </div>
    </div>
  )
}
