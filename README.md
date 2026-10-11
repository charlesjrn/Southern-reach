# Southern Reach Agency Hub

Internal staff platform for Southern Reach Marketing: rosters, timesheets, leave, tasks, payroll records and reporting. Built with React, TanStack Start, Vite, Tailwind CSS and Supabase.

## Requirements
- Node.js 20.19 or newer
- A Supabase project with the migrations in `supabase/migrations/` applied

## Local setup
```sh
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev
```

Open http://localhost:3000.

### Environment variables (`.env`)
| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon public key (browser) |
| `SUPABASE_URL` | Same project URL (server) |
| `SUPABASE_PUBLISHABLE_KEY` | Same anon public key (server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server only, never in the browser) |

Never commit `.env`. The service-role key bypasses row-level security.

## Scripts
- `npm run dev`: development server
- `npm run build`: production build
- `npm run test`: run tests
- `npm run lint`: lint the code

## Deployment
See [DEPLOY.md](./DEPLOY.md).
