-- T06 only: run in a NEW dedicated Supabase project, not another app's database.
create extension if not exists pgcrypto;
create table if not exists public.t06_plans (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 100), starts_on date not null, ends_on date not null,
 priority text not null default 'medium' check(priority in ('high','medium','low')),
 goal text not null check(length(trim(goal)) between 1 and 160), expected_minutes integer not null check(expected_minutes between 1 and 1440),
 is_public boolean not null default true, status text not null default 'active' check(status in ('active','closed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_on >= starts_on)
);
create table if not exists public.t06_plan_revisions (
 id bigint generated always as identity primary key, plan_id uuid not null references public.t06_plans(id) on delete cascade,
 previous_value jsonb not null, changed_by uuid not null references auth.users(id), changed_at timestamptz not null default now()
);
create table if not exists public.t06_tasks (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.t06_plans(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 140), due_on date not null,
 priority text not null default 'medium' check(priority in ('high','medium','low')),
 tag text not null default '' check(length(tag)<=30), expected_minutes integer not null check(expected_minutes between 1 and 1440),
 status text not null default 'todo' check(status in ('todo','doing','done')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.t06_logs (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.t06_tasks(id) on delete cascade,
 started_at timestamptz not null, ended_at timestamptz not null, reason text not null default '' check(length(reason)<=180),
 created_at timestamptz not null default now(), check(ended_at >= started_at and ended_at <= started_at + interval '24 hours')
);
create index if not exists t06_tasks_plan on public.t06_tasks(plan_id);
create index if not exists t06_logs_task on public.t06_logs(task_id);
create index if not exists t06_plan_owner on public.t06_plans(owner_id);
alter table public.t06_plans enable row level security;
alter table public.t06_plan_revisions enable row level security;
alter table public.t06_tasks enable row level security;
alter table public.t06_logs enable row level security;
-- Anonymous Supabase Auth sessions are authenticated-role users. Only owners write.
create policy "t06 plans read" on public.t06_plans for select to authenticated using (owner_id = (select auth.uid()) or is_public);
create policy "t06 plans create" on public.t06_plans for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "t06 plans edit" on public.t06_plans for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "t06 plans remove" on public.t06_plans for delete to authenticated using (owner_id = (select auth.uid()));
create policy "t06 tasks read" on public.t06_tasks for select to authenticated using (exists(select 1 from public.t06_plans p where p.id=plan_id and (p.owner_id=(select auth.uid()) or p.is_public)));
create policy "t06 tasks create" on public.t06_tasks for insert to authenticated with check (exists(select 1 from public.t06_plans p where p.id=plan_id and p.owner_id=(select auth.uid())));
create policy "t06 tasks edit" on public.t06_tasks for update to authenticated using (exists(select 1 from public.t06_plans p where p.id=plan_id and p.owner_id=(select auth.uid()))) with check (exists(select 1 from public.t06_plans p where p.id=plan_id and p.owner_id=(select auth.uid())));
create policy "t06 tasks delete" on public.t06_tasks for delete to authenticated using (exists(select 1 from public.t06_plans p where p.id=plan_id and p.owner_id=(select auth.uid())));
create policy "t06 logs read" on public.t06_logs for select to authenticated using (exists(select 1 from public.t06_tasks t join public.t06_plans p on p.id=t.plan_id where t.id=task_id and (p.owner_id=(select auth.uid()) or p.is_public)));
create policy "t06 logs create" on public.t06_logs for insert to authenticated with check (exists(select 1 from public.t06_tasks t join public.t06_plans p on p.id=t.plan_id where t.id=task_id and p.owner_id=(select auth.uid())));
create policy "t06 revisions read" on public.t06_plan_revisions for select to authenticated using (exists(select 1 from public.t06_plans p where p.id=plan_id and (p.owner_id=(select auth.uid()) or p.is_public)));
-- Revision insert is only via trusted trigger; not granted from client.
create or replace function public.t06_save_revision() returns trigger language plpgsql security invoker set search_path = public as $$
begin
 if row(OLD.title,OLD.starts_on,OLD.ends_on,OLD.priority,OLD.goal,OLD.expected_minutes,OLD.status,OLD.is_public)
    is distinct from row(NEW.title,NEW.starts_on,NEW.ends_on,NEW.priority,NEW.goal,NEW.expected_minutes,NEW.status,NEW.is_public) then
   insert into public.t06_plan_revisions(plan_id,previous_value,changed_by) values(OLD.id,to_jsonb(OLD), (select auth.uid()));
 end if;
 NEW.updated_at = now();return NEW;
end $$;
drop trigger if exists t06_revision_trigger on public.t06_plans;
create trigger t06_revision_trigger before update on public.t06_plans for each row execute function public.t06_save_revision();
-- PostgREST exposed table grants; RLS continues to restrict rows.
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.t06_plans, public.t06_tasks to authenticated;
grant select,insert on public.t06_logs to authenticated;
grant select on public.t06_plan_revisions to authenticated;
grant usage,select on sequence public.t06_plan_revisions_id_seq to authenticated;
-- Trigger's invoker requires revisions INSERT for owner update; ownership is enforced in trigger and policies.
create policy "t06 revisions by owner" on public.t06_plan_revisions for insert to authenticated with check (changed_by=(select auth.uid()) and exists(select 1 from public.t06_plans p where p.id=plan_id and p.owner_id=(select auth.uid())));
grant insert on public.t06_plan_revisions to authenticated;
