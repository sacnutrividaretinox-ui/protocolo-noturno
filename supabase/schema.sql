-- Rode no SQL Editor do Supabase.
create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null,
  difficulty int not null default 2 check (difficulty between 1 and 3),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists mission_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  mission_id uuid not null references missions on delete cascade,
  day date not null,
  done boolean not null default false,
  unique (mission_id, day)
);
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  day date not null,
  score int not null,
  journal text,
  unique (user_id, day)
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table missions enable row level security;
alter table mission_logs enable row level security;
alter table checkins enable row level security;
alter table messages enable row level security;

create policy "own missions" on missions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own logs" on mission_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own checkins" on checkins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own messages" on messages for all using (user_id = auth.uid()) with check (user_id = auth.uid());
