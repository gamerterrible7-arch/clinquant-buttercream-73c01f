# AGENTS.md — NiggaFlex Global

## Architecture

Static single-page frontend backed by Netlify Functions and Netlify Database (Postgres).

```
/
├── index.html                        # Entire frontend — no build step
├── netlify/
│   ├── functions/
│   │   ├── catalog.mts               # GET/POST/DELETE /api/catalog
│   │   └── auth.mts                  # POST /api/auth (admin key check)
│   └── database/
│       └── migrations/               # Auto-applied by Netlify at deploy
├── db/
│   ├── schema.ts                     # Drizzle ORM table definitions
│   └── index.ts                      # Drizzle client (netlify-db adapter)
├── drizzle.config.ts
├── package.json
├── netlify.toml
└── tsconfig.json
```

## Database Schema

Two tables:
- **media_items** — one row per movie or series (id, type, title, genre, creator, description, thumbnail, created_at)
- **episodes** — one or more rows per media_item (id, media_item_id FK, season, episode, url)

## Key Decisions

- **Drizzle beta**: `drizzle-orm@beta` and `drizzle-kit@beta` are required for the Netlify Database adapter. Do not remove the `@beta` tags.
- **Migrations output**: Must be `netlify/database/migrations/` (set in drizzle.config.ts). Netlify applies them automatically at deploy time.
- **Archive.org embed**: `<video>` tags fail for many archive.org items due to redirect chains and format quirks. The frontend detects archive.org hostnames and substitutes an `<iframe>` pointing to `https://archive.org/embed/IDENTIFIER` instead.
- **Server-side auth**: Admin key validation happens in the `auth.mts` function against `Netlify.env.get('ADMIN_KEY')`, not in frontend JS. Default fallback value exists for first-deploy convenience.
- **No framework**: Frontend is plain HTML+JS. Catalog data is fetched from `/api/catalog` on page load; there is no client-side router or state library.

## Adding Content

After any schema change, run `npx drizzle-kit generate` to produce a new migration file, then commit it. Never run `drizzle-kit migrate` or push DDL directly.

## Environment Variables

| Variable    | Default         | Description                        |
|-------------|-----------------|------------------------------------|
| `ADMIN_KEY` | `rafaqat-utra1` | Admin portal access key (change this in Netlify UI → Site settings → Environment variables) |
