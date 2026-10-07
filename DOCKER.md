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

Ordem de subida: `db` (healthy) → `api` (o CMD da imagem roda `dist/migrate.js` e depois o server; healthy em `/health`) → `web`.
A `NEXT_PUBLIC_API_URL` é embutida no build do front: se mudar no `.env`, rode `docker compose up -d --build web`.

## Migrations

```bash
docker compose run --rm api node dist/migrate.js                          # produção (também roda a cada start da api)
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

## Deploy no Render

O `render.yaml` (Blueprint) cria os web services Docker `v4-dashboard-api` e `v4-dashboard-web`, no plano free e em `oregon`. O banco é externo: Postgres no **Neon**.

1. Render → **New → Blueprint** → conecte o repo `Gui250/Dashboard-Acompanhamento` (branch principal). O Render lê o `render.yaml` da raiz.
2. As URLs já vêm fixas no `render.yaml`:
   - `CORS_ORIGIN` (api) = `https://v4-dashboard-web.onrender.com`
   - `NEXT_PUBLIC_API_URL` (web) = `https://v4-dashboard-api.onrender.com`

   Se os serviços ganharem outro nome ou domínio, atualize as duas no `render.yaml` e faça push. Sem elas o front chama `http://localhost:3333` e a API recusa o front no CORS ("Não foi possível conectar à API"). `NEXT_PUBLIC_API_URL` é embutida no build (o Render repassa as env vars como build args do Docker), então mudar a URL da API exige um **redeploy do web**. Mudar `CORS_ORIGIN` só reinicia a api.
3. `DATABASE_URL` (api) é preenchida **no painel do Render** com a connection string do Neon (`sync: false`: o Blueprint não sobrescreve). Nunca coloque essa URL no repositório, porque ela contém a senha. `JWT_SECRET` e `SETTINGS_SECRET` são geradas pelo Render. As migrations rodam a cada deploy, no start da api: se falharem (ex.: `DATABASE_URL` vazia ou errada), o deploy não sobe e o Render mantém a versão anterior no ar.
4. Depois do primeiro deploy: crie a conta em `/login` e cadastre a chave da OpenAI (e o token da Meta) na tela **Integrações**. Eles ficam no banco, cifrados com o `SETTINGS_SECRET`.

Limitações do plano free:

- Os web services dormem após 15 min sem tráfego; o primeiro acesso depois disso leva de ~30 s a 1 min.

### Levar os dados locais para o Neon

Use a connection string do Neon (painel do Neon → Connect). Se a api já rodou, as tabelas existem, e o `--clean` as substitui.

```bash
docker exec backend-db-1 pg_dump -U v4 -Fc v4_dashboard > v4.dump
docker run --rm -i postgres:16 pg_restore --clean --if-exists --no-owner -d "<connection string do Neon>" < v4.dump
```

As integrações salvas foram cifradas com o `SETTINGS_SECRET` local. Para continuarem válidas, copie o valor de `backend/.env` para o `SETTINGS_SECRET` da api no Render (e faça um redeploy); caso contrário, recadastre-as na tela Integrações.
