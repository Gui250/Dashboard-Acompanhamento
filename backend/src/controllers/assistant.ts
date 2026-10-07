import { Readable } from 'node:stream'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { streamAnswer } from '../agent/index.js'
import { getOpenAIConfig } from '../models/setting.js'
import type { chatBody } from '../views/assistant.js'

// Só o status: a mensagem de erro da OpenAI pode conter trechos da chave.
function openAIStatus(req: FastifyRequest, err: unknown) {
  const status = (err as { status?: number }).status
  req.log.error({ status }, 'assistant: falha ao chamar a OpenAI')
  return status
}

export async function chat(req: FastifyRequest<{ Body: z.infer<typeof chatBody> }>, reply: FastifyReply) {
  const config = await getOpenAIConfig()
  if (!config) return reply.status(409).send({ message: 'Configure a chave OpenAI em Integrações.' })

  const tokens = streamAnswer(config, req.body.messages)
  // Espera o 1º token antes de enviar os headers: erro de chave/modelo ainda vira 502 com JSON.
  let first: IteratorResult<string>
  try {
    first = await tokens.next()
  } catch (err) {
    const message = openAIStatus(req, err) === 401 ? 'Chave OpenAI inválida. Atualize em Integrações.' : 'O assistente não conseguiu responder agora.'
    return reply.status(502).send({ message })
  }

  async function* body() {
    if (first.done) return
    yield first.value
    try {
      yield* tokens
    } catch (err) {
      openAIStatus(req, err)
      yield '\n\n[O assistente não conseguiu terminar a resposta.]'
    }
  }
  return reply.type('text/plain; charset=utf-8').header('cache-control', 'no-cache').send(Readable.from(body()))
}
