import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import { join } from 'path'

const dbPath = app.isPackaged
  ? join(app.getPath('userData'), 'optimaclays.db')
  : join(__dirname, '../../prisma/dev.db')

export const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
})
