-- Staff sign in with their Employee ID. Returns the login email only for an active employee.
-- Callable before sign-in, so it exposes nothing beyond the email needed to authenticate.
create or replace function public.employee_login_email(_employee_id text)
returns text
language sql stable security definer set search_path = public as $$
  select p.email
  from public.profiles p
  where upper(p.employee_id) = upper(btrim(_employee_id))
    and p.is_active
  limit 1
$$;

revoke execute on function public.employee_login_email(text) from public;
grant execute on function public.employee_login_email(text) to anon, authenticated;
