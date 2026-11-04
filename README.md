# Reverb

Reverb is a digital music archive for musicians to manage and publish their work and for listeners to discover, play, and collect music. The project includes a web application and an Expo mobile application backed by the same API.

## Features

- Musician profiles, projects, and music releases with detailed credits and metadata.
- Audio and artwork uploads.
- Public discovery, search, artist pages, and audio playback.
- Listener favorites, libraries, and work reports.
- Administration for users, genres, releases, reports, and featured discovery content.
- A mobile API used by the Expo application.

## Architecture

The web application and API run in a single Next.js backend. The mobile app is a separate client of that API. The backend uses PostgreSQL for application data and Vercel Blob for uploaded media.

## Technology

- Web and API: Next.js, React, TypeScript
- Mobile: React Native, Expo, Expo Router
- Authentication: Better Auth
- Database: PostgreSQL, Drizzle ORM
- Media storage: Vercel Blob
- Tests: Vitest and Playwright

## Requirements

- Node.js and pnpm for the web application
- PostgreSQL
- Node.js and npm for the mobile application

## Web setup

From the repository root:

```bash
pnpm install
cp .env.example .env.local
```

Set the required values in `.env.local`, including `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `BLOB_READ_WRITE_TOKEN`. Keep real credentials out of version control.

Apply database migrations and start the development server:

```bash
pnpm db:migrate
pnpm dev
```

The server prints its local URL when ready.

Useful commands:

```bash
pnpm test
pnpm test:e2e
pnpm exec tsc --noEmit
pnpm db:check
pnpm build
pnpm start
```

The isolated E2E runner requires a local PostgreSQL account that can create and drop temporary test databases. Browser tests use Playwright Chromium; install it once with `pnpm exec playwright install chromium`.

## Mobile setup

```bash
cd mobile
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` to the backend API URL ending in `/api/v1`. Use the computer's LAN address for a physical device or `http://10.0.2.2:3000/api/v1` for the Android emulator.

Start Expo:

```bash
npm run start
```

The mobile package also provides `npm run ios`, `npm run android`, and `npm run web`.

## Project layout

| Path | Description |
| --- | --- |
| `app/` | Web pages, server actions, and API routes |
| `components/` | Shared web UI components |
| `modules/` | Application feature modules and domain operations |
| `lib/` | Authentication, database setup, and shared utilities |
| `drizzle/` | Database migrations and schema snapshots |
| `mobile/app/` | Expo screens and navigation |
| `mobile/src/` | Mobile API client and supporting code |
| `tests/` | Unit, integration, and browser E2E tests |
