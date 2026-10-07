import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Aplica drizzle/*.sql (mesmo controle do drizzle-kit: drizzle.__drizzle_migrations). Roda antes do server no CMD da imagem.
const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
await sql.end()
console.log('migrations ok')
