import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/models/metric.ts', './src/models/user.ts', './src/models/setting.ts', './src/models/creative.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
