# Deploying to Vercel

## 1. Create the project
Import this repository in Vercel. Vercel detects Bun from `bun.lock`. Build settings come from `vercel.json`.

## 2. Set environment variables (Project → Settings → Environment Variables)
| Name | Where it's used | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser and build | Public project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser and build | Public anon key |
| `SUPABASE_URL` | Server | Same project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Same anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | **Mark as Sensitive.** Never prefix with `VITE_`. |

`VITE_` values are built into the website, so anyone can read them. Only the service-role key must stay private.
Vercel does not read the `.env` file, so set these in the dashboard.

## 3. Database
Run `supabase/migrations/` in order on the Supabase project before the first deploy. Test on a copy first.

## 4. Domain and previews
- Add your domain under Settings → Domains.
- Replace `YOUR-DOMAIN.com.au` in `src/routes/__root.tsx` with that domain so social previews work.
- In Supabase → Authentication → URL Configuration, set the Site URL and add `https://YOUR-DOMAIN/**` as a redirect URL. Password reset links fail without this.

## 5. Checks after deploying
- `/does-not-exist` shows the branded 404 page.
- Response headers include `X-Robots-Tag: noindex`.
- Signing in as staff and as admin lands on the right page.
