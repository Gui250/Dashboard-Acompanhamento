import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { inArray, sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { db } from './db.js'

// Configurações globais do sistema (chave/valor). Segredos são gravados cifrados.
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

const secretKey = () => createHash('sha256').update(process.env.SETTINGS_SECRET!).digest()

// Formato salvo: "iv:tag:dados" (base64), AES-256-GCM nativo do Node.
function encrypt(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join(':')
}

function decrypt(stored: string) {
  const [iv, tag, data] = stored.split(':').map((s) => Buffer.from(s, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

const KEY = 'openai_api_key'
const MODEL = 'openai_model'

async function read(keys: string[]) {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// Usado pelo agente: null = OpenAI ainda não configurada.
export async function getOpenAIConfig(): Promise<{ apiKey: string; model: string } | null> {
  const s = await read([KEY, MODEL])
  return s[KEY] && s[MODEL] ? { apiKey: decrypt(s[KEY]), model: s[MODEL] } : null
}

// apiKey omitida = mantém a chave atual e só troca o modelo.
export async function saveOpenAIConfig({ apiKey, model }: { apiKey?: string; model: string }) {
  const rows = [{ key: MODEL, value: model }]
  if (apiKey) rows.push({ key: KEY, value: encrypt(apiKey) })
  await upsert(rows)
}

function upsert(rows: { key: string; value: string }[]) {
  return db
    .insert(settings)
    .values(rows)
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`excluded.value`, updatedAt: new Date() } })
}

const META_TOKEN = 'meta_access_token'
const META_BUSINESS = 'meta_business_id'

// null = Meta ainda não configurada.
export async function getMetaConfig(): Promise<{ accessToken: string; businessId: string } | null> {
  const s = await read([META_TOKEN, META_BUSINESS])
  return s[META_TOKEN] && s[META_BUSINESS] ? { accessToken: decrypt(s[META_TOKEN]), businessId: s[META_BUSINESS] } : null
}

// accessToken omitido = mantém o token atual e só troca a BM.
export async function saveMetaConfig({ accessToken, businessId }: { accessToken?: string; businessId: string }) {
  const rows = [{ key: META_BUSINESS, value: businessId }]
  if (accessToken) rows.push({ key: META_TOKEN, value: encrypt(accessToken) })
  await upsert(rows)
}
