-- Southern Reach Agency Hub: initial schema, RLS, audit and storage.
-- Converted from the Drizzle migration with security fixes applied (see hardening section).


-- ===== Enums =====
create type public.app_role as enum ('admin','management','hr','payroll','employee');
create type public.approval_status as enum ('draft','submitted','approved','rejected');
create type public.leave_type as enum ('annual','personal','carers','compassionate','long_service','unpaid','parental','other');
create type public.task_status as enum ('todo','in_progress','review','done');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.employment_type as enum ('full_time','part_time','casual','contractor');
create type public.project_status as enum ('planning','active','on_hold','completed','cancelled');

-- ===== Timestamp helper =====
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ===== Departments & positions =====
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  department_id uuid references public.departments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title, department_id)
);

-- ===== Profiles =====
create sequence public.employee_id_seq start 1001;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique default ('SRM-' || nextval('public.employee_id_seq')::text),
  full_name text not null default '',
  email text not null,
  phone text,
  department_id uuid references public.departments(id) on delete set null,
  position_id uuid references public.positions(id) on delete set null,
  manager_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- ===== Role helpers =====
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = _user_id and ur.role = any(_roles) and p.is_active)
$$;
create or replace function public.is_active_user(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from public.profiles where id = _user_id), false)
$$;

-- ===== Employment records (sensitive) =====
create table public.employment_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  employment_type public.employment_type not null default 'full_time',
  start_date date,
  end_date date,
  hourly_rate numeric(10,2) check (hourly_rate is null or hourly_rate >= 0),
  annual_salary numeric(12,2) check (annual_salary is null or annual_salary >= 0),
  standard_hours_per_week numeric(5,2) default 38,
  award text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Announcements =====
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Availability, shifts, attendance =====
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  role_label text,
  location text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  check (clock_out is null or clock_out > clock_in)
);

-- ===== Timesheets =====
create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  status public.approval_status not null default 'draft',
  notes text,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, week_start)
);
create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  work_date date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 24),
  description text,
  created_at timestamptz not null default now()
);

-- ===== Leave =====
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  status public.approval_status not null default 'submitted',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ===== Clients & projects =====
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  contact_name text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  name text not null check (char_length(name) between 1 and 150),
  description text,
  status public.project_status not null default 'planning',
  start_date date,
  due_date date,
  budget numeric(12,2),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Tasks =====
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  progress smallint not null default 0 check (progress between 0 and 100),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- ===== Payroll =====
create table public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date,
  ordinary_hours numeric(6,2) not null default 0,
  overtime_hours numeric(6,2) not null default 0,
  gross_pay numeric(12,2) not null default 0,
  allowances numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  tax_withheld numeric(12,2) not null default 0,
  super_amount numeric(12,2) not null default 0,
  net_pay numeric(12,2) not null default 0,
  published boolean not null default false,
  notes text,
  prepared_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

-- ===== Notifications & audit =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ===== updated_at triggers =====
do $$ declare t text; begin
  foreach t in array array['departments','positions','profiles','employment_records','announcements','shifts','timesheets','leave_requests','clients','projects','tasks','payroll_records'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ===== Audit trigger =====
create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if tg_op = 'DELETE' then rid := old.id; else rid := new.id; end if;
  insert into public.audit_logs(actor_id, action, table_name, record_id, details)
  values (auth.uid(), tg_op, tg_table_name, rid,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end; $$;
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();
create trigger audit_employment after insert or update or delete on public.employment_records for each row execute function public.audit_trigger();
create trigger audit_payroll after insert or update or delete on public.payroll_records for each row execute function public.audit_trigger();
create trigger audit_departments after insert or update or delete on public.departments for each row execute function public.audit_trigger();

-- audit profile activation changes only
create or replace function public.audit_profile_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active is distinct from old.is_active or new.department_id is distinct from old.department_id or new.position_id is distinct from old.position_id then
    insert into public.audit_logs(actor_id, action, table_name, record_id, details)
    values (auth.uid(), 'UPDATE', 'profiles', new.id,
      jsonb_build_object('is_active', new.is_active, 'department_id', new.department_id, 'position_id', new.position_id));
  end if;
  return new;
end; $$;
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_profile_status();

-- Prevent employees changing protected profile fields
create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]) then
    if new.employee_id is distinct from old.employee_id or new.is_active is distinct from old.is_active
       or new.department_id is distinct from old.department_id or new.position_id is distinct from old.position_id
       or new.manager_id is distinct from old.manager_id or new.email is distinct from old.email then
      raise exception 'Not allowed to change protected profile fields';
    end if;
  end if;
  return new;
end; $$;
create trigger guard_profiles before update on public.profiles for each row execute function public.guard_profile_update();

-- Guard approval fields on leave/timesheets for non-approvers
create or replace function public.guard_approval_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null only for trusted server/service-role calls, which are checked in server code
  if auth.uid() is null then return new; end if;
  if not public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]) then
    if new.status in ('approved','rejected') or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'Only managers can approve or reject';
    end if;
    if old.status in ('approved','rejected') then
      raise exception 'Reviewed records cannot be edited';
    end if;
  else
    if new.status in ('approved','rejected') then
      if new.reviewed_by is distinct from auth.uid() then
        raise exception 'reviewed_by must be the signed-in reviewer';
      end if;
      if new.profile_id = auth.uid() then
        raise exception 'You cannot approve or reject your own request';
      end if;
    end if;
  end if;
  return new;
end; $$;
create trigger guard_leave before update on public.leave_requests for each row execute function public.guard_approval_update();
create trigger guard_timesheets before update on public.timesheets for each row execute function public.guard_approval_update();

-- Notify on review
create or replace function public.notify_review() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into public.notifications(user_id, title, body, link)
    values (new.profile_id,
      initcap(replace(tg_table_name,'_',' ')) || ' ' || new.status::text,
      coalesce(new.review_comment, ''),
      case when tg_table_name = 'leave_requests' then '/leave' else '/timesheets' end);
  end if;
  return new;
end; $$;
create trigger notify_leave after update on public.leave_requests for each row execute function public.notify_review();
create trigger notify_timesheets after update on public.timesheets for each row execute function public.notify_review();

create or replace function public.notify_task_assigned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) and new.assignee_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications(user_id, title, body, link) values (new.assignee_id, 'New task assigned', new.title, '/tasks');
  end if;
  return new;
end; $$;
create trigger notify_tasks after insert or update on public.tasks for each row execute function public.notify_task_assigned();

-- ===== New user -> profile =====
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.employment_records(profile_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== Grants =====
grant select, insert, update, delete on public.departments, public.positions, public.profiles, public.employment_records,
  public.announcements, public.availability, public.shifts, public.attendance, public.timesheets, public.timesheet_entries,
  public.leave_requests, public.clients, public.projects, public.tasks, public.task_comments, public.payroll_records,
  public.notifications to authenticated;
grant select on public.user_roles, public.audit_logs to authenticated;
grant all on all tables in schema public to service_role;
grant usage on sequence public.employee_id_seq to service_role, authenticated;

-- ===== RLS =====
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.employment_records enable row level security;
alter table public.announcements enable row level security;
alter table public.availability enable row level security;
alter table public.shifts enable row level security;
alter table public.attendance enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.leave_requests enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.payroll_records enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- departments / positions
create policy "active staff read departments" on public.departments for select to authenticated using (public.is_active_user(auth.uid()));
create policy "admin hr manage departments" on public.departments for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));
create policy "active staff read positions" on public.positions for select to authenticated using (public.is_active_user(auth.uid()));
create policy "admin hr manage positions" on public.positions for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));

-- profiles (directory)
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "active staff read directory" on public.profiles for select to authenticated using (public.is_active_user(auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin hr update profiles" on public.profiles for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));

-- user_roles
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "staff managers read roles" on public.user_roles for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr','management']::public.app_role[]));

-- employment records
create policy "read own employment" on public.employment_records for select to authenticated using (profile_id = auth.uid());
create policy "hr payroll admin read employment" on public.employment_records for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr','payroll']::public.app_role[]));
create policy "hr admin write employment" on public.employment_records for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));

-- announcements
create policy "staff read announcements" on public.announcements for select to authenticated using (public.is_active_user(auth.uid()));
create policy "leaders manage announcements" on public.announcements for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

-- availability
create policy "own availability" on public.availability for all to authenticated
  using (profile_id = auth.uid() and public.is_active_user(auth.uid())) with check (profile_id = auth.uid() and public.is_active_user(auth.uid()));
create policy "leaders read availability" on public.availability for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

-- shifts
create policy "staff read shifts" on public.shifts for select to authenticated using (public.is_active_user(auth.uid()));
create policy "leaders manage shifts" on public.shifts for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

-- attendance
create policy "own attendance read" on public.attendance for select to authenticated using (profile_id = auth.uid());
create policy "own clock in" on public.attendance for insert to authenticated with check (profile_id = auth.uid() and public.is_active_user(auth.uid()));
create policy "own clock out" on public.attendance for update to authenticated using (profile_id = auth.uid() and clock_out is null) with check (profile_id = auth.uid());
create policy "leaders attendance" on public.attendance for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr','payroll']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

-- timesheets
create policy "own timesheets read" on public.timesheets for select to authenticated using (profile_id = auth.uid());
create policy "own timesheets insert" on public.timesheets for insert to authenticated with check (profile_id = auth.uid() and status in ('draft','submitted') and public.is_active_user(auth.uid()));
create policy "own timesheets update" on public.timesheets for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "own draft timesheets delete" on public.timesheets for delete to authenticated using (profile_id = auth.uid() and status = 'draft');
create policy "reviewers read timesheets" on public.timesheets for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr','payroll']::public.app_role[]));
create policy "reviewers update timesheets" on public.timesheets for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

create policy "entries via timesheet read" on public.timesheet_entries for select to authenticated using (
  exists (select 1 from public.timesheets t where t.id = timesheet_id and (t.profile_id = auth.uid()
    or public.has_any_role(auth.uid(), array['admin','management','hr','payroll']::public.app_role[]))));
create policy "own entries write" on public.timesheet_entries for all to authenticated using (
  exists (select 1 from public.timesheets t where t.id = timesheet_id and t.profile_id = auth.uid() and t.status = 'draft'))
  with check (exists (select 1 from public.timesheets t where t.id = timesheet_id and t.profile_id = auth.uid() and t.status = 'draft'));

-- leave
create policy "own leave read" on public.leave_requests for select to authenticated using (profile_id = auth.uid());
create policy "own leave insert" on public.leave_requests for insert to authenticated with check (profile_id = auth.uid() and status = 'submitted' and public.is_active_user(auth.uid()));
create policy "own pending leave delete" on public.leave_requests for delete to authenticated using (profile_id = auth.uid() and status = 'submitted');
create policy "reviewers read leave" on public.leave_requests for select to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr','payroll']::public.app_role[]));
create policy "reviewers update leave" on public.leave_requests for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));

-- clients & projects
create policy "staff read clients" on public.clients for select to authenticated using (public.is_active_user(auth.uid()));
create policy "leaders manage clients" on public.clients for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]));
create policy "staff read projects" on public.projects for select to authenticated using (public.is_active_user(auth.uid()));
create policy "leaders manage projects" on public.projects for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]));

-- tasks
create policy "read tasks" on public.tasks for select to authenticated using (
  assignee_id = auth.uid() or created_by = auth.uid()
  or public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]));
create policy "create tasks" on public.tasks for insert to authenticated with check (
  created_by = auth.uid() and public.is_active_user(auth.uid())
  and (assignee_id = auth.uid() or assignee_id is null or public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[])));
create policy "update tasks" on public.tasks for update to authenticated using (
  assignee_id = auth.uid() or created_by = auth.uid()
  or public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]))
  with check (public.is_active_user(auth.uid()));
create policy "delete tasks" on public.tasks for delete to authenticated using (
  created_by = auth.uid() or public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]));

create policy "read task comments" on public.task_comments for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
    or public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))));
create policy "write task comments" on public.task_comments for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
    or public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]))));
create policy "delete own comments" on public.task_comments for delete to authenticated using (author_id = auth.uid());

-- payroll
create policy "own published payslips" on public.payroll_records for select to authenticated using (profile_id = auth.uid() and published);
create policy "payroll admin manage" on public.payroll_records for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','payroll']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','payroll']::public.app_role[]));

-- notifications
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- audit
create policy "admin read audit" on public.audit_logs for select to authenticated using (public.has_any_role(auth.uid(), array['admin']::public.app_role[]));
create policy "payroll read payroll audit" on public.audit_logs for select to authenticated
  using (table_name = 'payroll_records' and public.has_any_role(auth.uid(), array['payroll']::public.app_role[]));

-- seed reference data
insert into public.departments(name, description) values
  ('Leadership','Directors and senior management'),
  ('Creative','Design, copy and content'),
  ('Digital','Paid media, SEO and social'),
  ('Accounts','Client services and account management'),
  ('Operations','HR, payroll and administration')
on conflict (name) do nothing;

-- ===== Hardening =====
-- Lock down default Supabase grants: anonymous visitors get nothing.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke execute on all functions in schema public from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_any_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.is_active_user(uuid) to authenticated;
-- Trigger-only functions must not be callable directly.
revoke execute on function public.handle_new_user() from authenticated, anon, public;
revoke execute on function public.audit_trigger() from authenticated, anon, public;
revoke execute on function public.audit_profile_status() from authenticated, anon, public;
revoke execute on function public.guard_profile_update() from authenticated, anon, public;
revoke execute on function public.guard_approval_update() from authenticated, anon, public;
revoke execute on function public.notify_review() from authenticated, anon, public;
revoke execute on function public.notify_task_assigned() from authenticated, anon, public;
revoke execute on function public.set_updated_at() from authenticated, anon, public;

-- Reviewers may not approve their own leave or timesheets (also enforced by trigger).
drop policy if exists "reviewers update timesheets" on public.timesheets;
create policy "reviewers update timesheets" on public.timesheets for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]) and profile_id <> auth.uid())
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]) and profile_id <> auth.uid());
drop policy if exists "reviewers update leave" on public.leave_requests;
create policy "reviewers update leave" on public.leave_requests for update to authenticated
  using (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]) and profile_id <> auth.uid())
  with check (public.has_any_role(auth.uid(), array['admin','management','hr']::public.app_role[]) and profile_id <> auth.uid());

-- Employees cannot edit a timesheet once submitted (only drafts are editable).
drop policy if exists "own timesheets update" on public.timesheets;
create policy "own timesheets update" on public.timesheets for update to authenticated
  using (profile_id = auth.uid() and status = 'draft')
  with check (profile_id = auth.uid() and status in ('draft','submitted'));

-- Task reassignment and ownership changes are limited to managers and creators (trigger below).
create or replace function public.guard_task_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_any_role(auth.uid(), array['admin','management']::public.app_role[]) then
    if new.created_by is distinct from old.created_by or new.assignee_id is distinct from old.assignee_id then
      if not (old.created_by = auth.uid()) then
        raise exception 'Only the task creator or a manager can reassign tasks';
      end if;
    end if;
  end if;
  return new;
end; $$;
create trigger guard_tasks before update on public.tasks for each row execute function public.guard_task_update();
revoke execute on function public.guard_task_update() from authenticated, anon, public;

-- Keep payroll records locked once published (corrections go through a new record).
create or replace function public.guard_published_payroll() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.published and auth.uid() is not null then
    raise exception 'Published payroll records cannot be changed';
  end if;
  return new;
end; $$;
create trigger guard_payroll before update on public.payroll_records for each row execute function public.guard_published_payroll();
revoke execute on function public.guard_published_payroll() from authenticated, anon, public;

-- Setup lock: bootstrapAdmin inserts here first so two simultaneous first-admin requests cannot both succeed.
create table public.setup_state (
  id boolean primary key default true check (id),
  completed_at timestamptz not null default now()
);
alter table public.setup_state enable row level security;
revoke all on public.setup_state from anon, authenticated;

-- ===== Storage: private HR documents bucket =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-documents', 'hr-documents', false, 10485760,
        array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored under <profile_id>/<filename>.
create policy "hr docs: staff read own folder" on storage.objects for select to authenticated using (
  bucket_id = 'hr-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "hr docs: hr admin read all" on storage.objects for select to authenticated using (
  bucket_id = 'hr-documents' and public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));
create policy "hr docs: hr admin upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'hr-documents' and public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));
create policy "hr docs: hr admin delete" on storage.objects for delete to authenticated using (
  bucket_id = 'hr-documents' and public.has_any_role(auth.uid(), array['admin','hr']::public.app_role[]));
