import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authRoutes } from './routes/auth.js'
import { metricsRoutes } from './routes/metrics.js'
import { assistantRoutes } from './routes/assistant.js'
import { googleCallbackRoutes, integrationsRoutes } from './routes/integrations.js'
import { creativesRoutes } from './routes/creatives.js'
import { mcpRoutes } from './routes/mcp.js'
import { governanceRoutes } from './routes/governance.js'

z.config(z.locales.pt()) // mensagens de validação em português

const app = Fastify({ logger: true })

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'], // o padrão do @fastify/cors v11 é só GET/HEAD/POST
})
await app.register(jwt, { secret: process.env.JWT_SECRET!, sign: { expiresIn: '7d' } })
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
await app.register(authRoutes)
await app.register(metricsRoutes)
await app.register(assistantRoutes)
await app.register(integrationsRoutes)
await app.register(googleCallbackRoutes)
await app.register(creativesRoutes)
await app.register(mcpRoutes)
await app.register(governanceRoutes)

app.get('/health', async () => ({ status: 'ok' }))

app
  .listen({ port: Number(process.env.PORT ?? 3333), host: '0.0.0.0' })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })
