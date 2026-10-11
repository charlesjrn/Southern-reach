-- Server-side Employee ID sign-in with rate limiting.
-- The lookup function is removed: the browser never learns which email belongs to an Employee ID.
drop function if exists public.employee_login_email(text);

-- Failed and successful sign-in attempts, used for rate limiting. Only the server reads or writes this table.
create table public.login_attempts (
  id bigint generated always as identity primary key,
  employee_id text not null,
  ip text,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);
create index login_attempts_employee_idx on public.login_attempts (employee_id, attempted_at);
create index login_attempts_ip_idx on public.login_attempts (ip, attempted_at);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
-- No policies: only the service role (server code) can access this table.
