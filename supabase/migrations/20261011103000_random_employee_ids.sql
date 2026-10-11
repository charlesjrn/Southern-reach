-- Employee IDs are random (SRM-XXXXXXXX) instead of sequential, so they can't be guessed.
-- Each ID comes from the database's secure random source and is checked for uniqueness.
create or replace function public.generate_employee_id()
returns text
language plpgsql volatile set search_path = public as $$
declare
  candidate text;
begin
  loop
    candidate := 'SRM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where employee_id = candidate);
  end loop;
  return candidate;
end; $$;

revoke execute on function public.generate_employee_id() from public, anon, authenticated;

alter table public.profiles alter column employee_id set default public.generate_employee_id();
drop sequence if exists public.employee_id_seq;
