-- Staff directory privacy: email and phone are visible only to the person themselves
-- and to Admin, HR and Management. Everyone else sees names, roles and roster data only.

-- 1. Column-level read: remove email and phone from general table access.
revoke select on public.profiles from authenticated;
grant select (id, employee_id, full_name, department_id, position_id, manager_id, is_active, created_at, updated_at)
  on public.profiles to authenticated;

-- 2. Column-level write: users cannot change their own email or employee ID.
--    Protected fields (department, position, manager, active) are still checked by guard_profile_update.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, department_id, position_id, manager_id, is_active)
  on public.profiles to authenticated;

-- 3. Contact lookup: returns email and phone only for the caller's own record,
--    or for everyone when the caller is Admin, HR or Management.
create or replace function public.get_profile_contacts()
returns table (id uuid, email text, phone text)
language sql stable security definer set search_path = public as $$
  select p.id, p.email, p.phone
  from public.profiles p
  where public.is_active_user(auth.uid())
    and (p.id = auth.uid()
         or public.has_any_role(auth.uid(), array['admin','hr','management']::public.app_role[]));
$$;
revoke execute on function public.get_profile_contacts() from anon, public;
grant execute on function public.get_profile_contacts() to authenticated;
