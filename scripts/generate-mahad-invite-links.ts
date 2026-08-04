import { prisma } from '@/lib/db'
import { createInviteToken } from '@/lib/utils/invite-token'

import { runScript } from './lib/run-script'

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    console.error('ERROR: set NODE_ENV=production to generate live links.')
    process.exit(1)
  }
  if (!process.env.MAHAD_INVITE_SECRET) {
    console.error('ERROR: MAHAD_INVITE_SECRET is not set.')
    process.exit(1)
  }
  const baseUrl = process.env.BASE_URL ?? 'https://irshadcenter.com'

  const profiles = await prisma.programProfile.findMany({
    where: {
      program: 'MAHAD_PROGRAM',
      person: { email: null, phone: null },
    },
    select: { id: true, person: { select: { name: true } } },
    orderBy: { person: { name: 'asc' } },
  })

  for (const p of profiles) {
    const token = createInviteToken(p.id)
    console.log(
      `${p.person.name}\t${baseUrl}/mahad/register?invite=${encodeURIComponent(token)}`
    )
  }
  console.log(`\n${profiles.length} invite links generated`)
}

runScript(main, { cleanup: () => prisma.$disconnect() })
