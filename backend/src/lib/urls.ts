// Endereços públicos para links em e-mails e respostas do MCP.
// Front: primeira origem do CORS. API: o Render preenche RENDER_EXTERNAL_URL; local, a porta do .env.
export const webUrl = () => (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',')[0]
export const apiUrl = () => process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${process.env.PORT ?? 3333}`
