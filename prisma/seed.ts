import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Dev/test seeding only: this always re-hashes and overwrites the admin
// password. The app's first-launch flow must check if User is empty before
// seeding, per the design spec, not call this script's logic directly.
async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash('Admin@1234', 12)

  await prisma.user.upsert({
    where: { email: 'admin@optimaclays.rw' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@optimaclays.rw',
      password: hashedPassword,
      full_name: 'System Administrator',
      role: Role.ADMIN
    }
  })

  console.log('Seed completed: admin user ready')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
