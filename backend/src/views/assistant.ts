import { z } from 'zod'

// Sem estado no servidor: o cliente reenvia o histórico a cada pergunta.
export const chatBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(30),
})
