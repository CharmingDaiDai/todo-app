create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists vault;

create table if not exists public.todo_reminders (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.todos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('hour', 'ten_minutes', 'custom_date')),
  due_date timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz not null default timezone('utc', now()),
  unique (todo_id, reminder_type, due_date)
);

alter table public.todo_reminders drop constraint if exists todo_reminders_reminder_type_check;
alter table public.todo_reminders add constraint todo_reminders_reminder_type_check check (reminder_type in ('hour', 'ten_minutes', 'custom_date'));

create index if not exists idx_todo_reminders_user_id on public.todo_reminders (user_id, sent_at desc);
create index if not exists idx_todo_reminders_todo_id on public.todo_reminders (todo_id, reminder_type);

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid references public.todos(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  push_subscription_id uuid references public.push_subs(id) on delete set null,
  reminder_type text check (reminder_type in ('hour', 'ten_minutes', 'custom_date')),
  status text not null check (status in ('sent', 'failed', 'subscription_removed', 'skipped')),
  endpoint text,
  error_message text,
  response_status integer,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.push_delivery_logs drop constraint if exists push_delivery_logs_reminder_type_check;
alter table public.push_delivery_logs add constraint push_delivery_logs_reminder_type_check check (reminder_type in ('hour', 'ten_minutes', 'custom_date'));

create index if not exists idx_push_delivery_logs_user_id on public.push_delivery_logs (user_id, created_at desc);
create index if not exists idx_push_delivery_logs_todo_id on public.push_delivery_logs (todo_id, created_at desc);

alter table public.todo_reminders enable row level security;
alter table public.push_delivery_logs enable row level security;

drop policy if exists "todo_reminders_select_own" on public.todo_reminders;
create policy "todo_reminders_select_own"
on public.todo_reminders
for select
using (auth.uid() = user_id);

drop policy if exists "push_delivery_logs_select_own" on public.push_delivery_logs;
create policy "push_delivery_logs_select_own"
on public.push_delivery_logs
for select
using (auth.uid() = user_id);

create or replace function public.invoke_send_due_reminders()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  request_id bigint;
begin
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-due-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_push_token')
      ),
      body := jsonb_build_object('triggered_at', timezone('utc', now())),
      timeout_milliseconds := 10000
    )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_send_due_reminders()
is 'Invokes the send-due-reminders edge function using pg_net. Requires vault secrets project_url and cron_push_token.';

select cron.unschedule('send-due-reminders-every-minute')
where exists (
  select 1
  from cron.job
  where jobname = 'send-due-reminders-every-minute'
);

select cron.schedule(
  'send-due-reminders-every-minute',
  '* * * * *',
  $$
  select public.invoke_send_due_reminders();
  $$
);