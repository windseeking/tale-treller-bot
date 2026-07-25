<img height="70" src="https://raw.githubusercontent.com/windseeking/tale-treller-bot/refs/heads/master/taletreller.png" title="Tale Treller Bot Logo" width="70"/>

# Tale Treller Bot

[@taletrellerbot](https://t.me/taletrellerbot)

Telegram bot that collects user messages and creates Trello cards in the user's own Trello account.

**Stack**: Vue 3, TypeScript, Express, PrimeVue, Tailwind.

## Requirements

- Node.js 20+
- npm
- Docker and Docker Compose, if you want to run PostgreSQL locally in a container
- Telegram bot token from BotFather
- Trello API key and API secret
- LLM API key compatible with the configured `LLM_BASE_URL`
- Public HTTPS URL for Trello OAuth callbacks in local development, for example via ngrok or another tunnel

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill `.env`.

   Required application values:

   ```dotenv
   NODE_ENV=development
   LOG_LEVEL=info
   APP_TIMEZONE=Europe/Lisbon
   APP_BASE_URL=https://your-public-host.example
   APP_PORT=3000
   ```

   Database values for Docker Compose must match `DATABASE_URL`:

   ```dotenv
   POSTGRES_DB=tg_trello_bot
   POSTGRES_USER=tg_user
   POSTGRES_PASSWORD=change_me_strong
   DATABASE_URL=postgresql://tg_user:change_me_strong@postgres:5432/tg_trello_bot
   ```

   For running the app directly on the host while PostgreSQL is exposed from Docker, use `localhost` instead of `postgres`:

   ```dotenv
   DATABASE_URL=postgresql://tg_user:change_me_strong@localhost:5432/tg_trello_bot
   ```

   Telegram, Trello, encryption, and LLM values:

   ```dotenv
   TELEGRAM_BOT_TOKEN=
   TRELLO_API_KEY=
   TRELLO_API_SECRET=
   AUTH_ENCRYPTION_KEY=
   AUTH_SESSION_TTL_MINUTES=15
   TRELLO_AUTH_TTL_DAYS=30
   LLM_API_KEY=
   LLM_MODEL=gpt-5-mini
   LLM_BASE_URL=https://api.openai.com/v1
   ```

   Generate `AUTH_ENCRYPTION_KEY` as a base64-encoded 32-byte key:

   ```bash
   openssl rand -base64 32
   ```

4. Configure the Trello app callback.

   `APP_BASE_URL` must be reachable by Trello and Telegram users. The bot uses these HTTP endpoints:

   - `GET /auth/trello/start`
   - `GET /auth/trello/callback`
   - `GET /auth/trello/result`

   In Trello developer settings, use this callback URL:

   ```text
   https://your-public-host.example/auth/trello/callback
   ```

5. Start PostgreSQL.

   If you run the whole project with Docker Compose:

   ```bash
   docker compose up --build
   ```

   If you run only PostgreSQL in Docker and the app on the host:

   ```bash
   docker compose up -d postgres
   npm run dev
   ```

6. Verify the project before completing changes:

   ```bash
   npm run typecheck
   ```

## Useful Commands

```bash
npm run dev        # start the bot in watch mode
npm run dev:app    # start the Vue settings App dev server
npm run build      # build server and settings App
npm run build:app  # build the Vue settings App into dist/public/app
npm start          # run compiled app from dist/
npm run typecheck  # run TypeScript checks without emitting files
```

Recreate Docker Compose containers:

```bash
docker compose down
docker compose up -d --build
```

## Runtime Notes

- Database migrations run automatically during application bootstrap.
- The app starts one Node.js process with both the Telegram polling bot and the Express HTTP server for Trello OAuth.
- User Trello credentials are stored per Telegram user and encrypted at rest.
- If a user has not configured a timezone, card generation falls back to `APP_TIMEZONE`.
