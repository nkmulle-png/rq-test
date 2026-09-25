# GITHUB-SIDE-CONFLICT-TEST

An internal training tracker for the RDHQ team. Employees browse training topics and courses for their tier, commit to and complete courses, and rate them. Managers get a read-only rollup of their team's progress. Users marked "Training Not Required" skip course selection and land on a shared course library / team view instead.

Built with [TanStack Start](https://tanstack.com/start) (React 19) on Cloudflare Workers, with [Supabase](https://supabase.com/) as the data layer and `@lovable.dev/cloud-auth-js` for authentication.

## Tech stack

- **Framework:** TanStack Start + TanStack Router, deployed to Cloudflare Workers via `@cloudflare/vite-plugin` / Wrangler
- **UI:** React 19, Tailwind CSS v4, Radix UI primitives, shadcn-style components in [src/components/ui](src/components/ui)
- **Data:** Supabase (Postgres + RLS), migrations in [supabase/migrations](supabase/migrations)
- **Auth:** `@lovable.dev/cloud-auth-js`, wired up in [src/lib/auth.tsx](src/lib/auth.tsx) and [src/integrations/supabase](src/integrations/supabase)
- **Forms/validation:** react-hook-form + zod
- **Tooling:** TypeScript, ESLint, Prettier, Vite

## Getting started

Install dependencies and start the dev server:

```
npm install
npm run dev
```

Other scripts:

```
npm run build      # production build
npm run build:dev  # development-mode build
npm run preview    # preview the production build
npm run lint       # eslint
npm run format     # prettier --write .
```

### Environment

Copy `.env` locally (not committed) with the Supabase project URL/key and any lovable.dev auth config the app needs to reach your Supabase instance.

### Database

Supabase migrations live in [supabase/migrations](supabase/migrations). Apply them with the Supabase CLI against your project, or via `supabase db push` if you have the CLI linked.

## Project structure

```
src/
  routes/        # TanStack Router file-based routes (/, /login, /manager)
  components/ui/ # shared UI primitives
  integrations/   # Supabase client + auth wiring
  lib/            # auth context, platform helpers, error handling
  server.ts       # Cloudflare Worker entrypoint
```

## Deployment

The app targets Cloudflare Workers (see [wrangler.jsonc](wrangler.jsonc)). Build with `npm run build`, then deploy with Wrangler per your Cloudflare account setup.
