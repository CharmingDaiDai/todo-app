create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'completed')),
  priority smallint not null default 2 check (priority between 1 and 3),
  due_date timestamptz,
  order_index double precision not null default 1000,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  todo_id uuid not null references public.todos(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  is_completed boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#1258d6',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.todo_tags (
  todo_id uuid not null references public.todos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (todo_id, tag_id)
);

create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  auth text not null,
  p256dh text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, endpoint)
);

create index if not exists idx_todos_user_id_created_at on public.todos (user_id, created_at desc);
create index if not exists idx_todos_user_id_due_date on public.todos (user_id, due_date asc nulls last);
create index if not exists idx_todos_user_id_order_index on public.todos (user_id, order_index asc);
create index if not exists idx_subtasks_todo_id on public.subtasks (todo_id, order_index asc);
create index if not exists idx_tags_user_id on public.tags (user_id, name asc);
create index if not exists idx_push_subs_user_id on public.push_subs (user_id, created_at desc);

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.set_updated_at();

drop trigger if exists set_subtasks_updated_at on public.subtasks;
create trigger set_subtasks_updated_at
before update on public.subtasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_tags_updated_at on public.tags;
create trigger set_tags_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

drop trigger if exists set_push_subs_updated_at on public.push_subs;
create trigger set_push_subs_updated_at
before update on public.push_subs
for each row
execute function public.set_updated_at();

alter table public.todos enable row level security;
alter table public.subtasks enable row level security;
alter table public.tags enable row level security;
alter table public.todo_tags enable row level security;
alter table public.push_subs enable row level security;

drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own"
on public.todos
for select
using (auth.uid() = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own"
on public.todos
for insert
with check (auth.uid() = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own"
on public.todos
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own"
on public.todos
for delete
using (auth.uid() = user_id);

drop policy if exists "subtasks_select_own" on public.subtasks;
create policy "subtasks_select_own"
on public.subtasks
for select
using (
  exists (
    select 1
    from public.todos
    where todos.id = subtasks.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "subtasks_insert_own" on public.subtasks;
create policy "subtasks_insert_own"
on public.subtasks
for insert
with check (
  exists (
    select 1
    from public.todos
    where todos.id = subtasks.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "subtasks_update_own" on public.subtasks;
create policy "subtasks_update_own"
on public.subtasks
for update
using (
  exists (
    select 1
    from public.todos
    where todos.id = subtasks.todo_id
      and todos.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.todos
    where todos.id = subtasks.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "subtasks_delete_own" on public.subtasks;
create policy "subtasks_delete_own"
on public.subtasks
for delete
using (
  exists (
    select 1
    from public.todos
    where todos.id = subtasks.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own"
on public.tags
for select
using (auth.uid() = user_id);

drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own"
on public.tags
for insert
with check (auth.uid() = user_id);

drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own"
on public.tags
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own"
on public.tags
for delete
using (auth.uid() = user_id);

drop policy if exists "todo_tags_select_own" on public.todo_tags;
create policy "todo_tags_select_own"
on public.todo_tags
for select
using (
  exists (
    select 1
    from public.todos
    where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "todo_tags_insert_own" on public.todo_tags;
create policy "todo_tags_insert_own"
on public.todo_tags
for insert
with check (
  exists (
    select 1
    from public.todos
    where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.tags
    where tags.id = todo_tags.tag_id
      and tags.user_id = auth.uid()
  )
);

drop policy if exists "todo_tags_delete_own" on public.todo_tags;
create policy "todo_tags_delete_own"
on public.todo_tags
for delete
using (
  exists (
    select 1
    from public.todos
    where todos.id = todo_tags.todo_id
      and todos.user_id = auth.uid()
  )
);

drop policy if exists "push_subs_select_own" on public.push_subs;
create policy "push_subs_select_own"
on public.push_subs
for select
using (auth.uid() = user_id);

drop policy if exists "push_subs_insert_own" on public.push_subs;
create policy "push_subs_insert_own"
on public.push_subs
for insert
with check (auth.uid() = user_id);

drop policy if exists "push_subs_update_own" on public.push_subs;
create policy "push_subs_update_own"
on public.push_subs
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_subs_delete_own" on public.push_subs;
create policy "push_subs_delete_own"
on public.push_subs
for delete
using (auth.uid() = user_id);