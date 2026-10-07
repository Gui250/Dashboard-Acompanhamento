# Docker

Arquivos: `backend/Dockerfile` e `frontend/Dockerfile` (multi-stage, `node:24-alpine`, usuário `node`), `docker-compose.yml` (produção) e `docker-compose.dev.yml` (dev).

## Dev (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build        # front :3000, API :3333
docker compose -f docker-compose.dev.yml up --build -V     # depois de mudar package.json (recria node_modules)
```

O código entra por bind mount (`tsx watch` / `next dev`); `node_modules` e `.next` ficam em volumes do container.
As migrations rodam sozinhas quando a API sobe. Para trocar as portas: `API_PORT=4333 WEB_PORT=4000 docker compose -f docker-compose.dev.yml up`.
O Postgres de dev não é exposto no host: `docker compose -f docker-compose.dev.yml exec db psql -U v4 v4_dashboard`.

## Produção

```bash
cp .env.example .env    # preencha senhas e segredos (openssl rand -hex 32)
docker compose up -d --build
```

Ordem de subida: `db` (healthy) → `migrate` (one-shot, aplica `backend/drizzle/*.sql`) → `api` (healthy em `/health`) → `web`.
A `NEXT_PUBLIC_API_URL` é embutida no build do front: se mudar no `.env`, rode `docker compose up -d --build web`.

## Migrations

```bash
docker compose run --rm migrate                                            # produção (também roda a cada `up`)
docker compose -f docker-compose.dev.yml exec api npx drizzle-kit migrate  # dev
```

Gerar uma migration nova continua sendo no host: `cd backend && npm run db:generate`.

## Logs / status / derrubar

```bash
docker compose ps
docker compose logs -f api web
docker compose down          # mantém o banco
docker compose down -v       # APAGA o volume do banco
```

Para dev, acrescente `-f docker-compose.dev.yml`.

## Levar os dados do Postgres atual (`backend-db-1`) para a produção

```bash
docker exec backend-db-1 pg_dump -U v4 -Fc v4_dashboard > v4.dump
docker compose up -d db
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < v4.dump
docker compose up -d --build
```

Use o mesmo `SETTINGS_SECRET` do `backend/.env`; caso contrário, a chave da OpenAI salva no banco não decifra.
