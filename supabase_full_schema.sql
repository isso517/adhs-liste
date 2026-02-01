create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  friend_code text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles add column if not exists friend_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_friend_code_key'
  ) then
    alter table profiles add constraint profiles_friend_code_key unique (friend_code);
  end if;
end $$;

alter table profiles enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Public profiles are viewable by everyone.') then
    drop policy "Public profiles are viewable by everyone." on profiles;
  end if;
end $$;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can insert their own profile.') then
    drop policy "Users can insert their own profile." on profiles;
  end if;
end $$;
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users can update own profile.') then
    drop policy "Users can update own profile." on profiles;
  end if;
end $$;
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

create table if not exists user_stats (
  user_id uuid references profiles(id) not null primary key,
  points integer default 0,
  total_points integer default 0,
  tasks_completed_daily integer default 0,
  tasks_completed_weekly integer default 0,
  tasks_completed_monthly integer default 0,
  active_theme_id text default 'default',
  claimed_achievement_ids text[] default '{}',
  unlocked_achievement_ids text[] default '{}',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table user_stats add column if not exists active_theme_id text default 'default';
alter table user_stats add column if not exists claimed_achievement_ids text[] default '{}';
alter table user_stats add column if not exists unlocked_achievement_ids text[] default '{}';

alter table user_stats enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Stats are viewable by everyone.') then
    drop policy "Stats are viewable by everyone." on user_stats;
  end if;
end $$;
create policy "Stats are viewable by everyone." on user_stats for select using (true);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Users can update own stats.') then
    drop policy "Users can update own stats." on user_stats;
  end if;
end $$;
create policy "Users can update own stats." on user_stats for update using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_stats' and policyname = 'Users can insert own stats.') then
    drop policy "Users can insert own stats." on user_stats;
  end if;
end $$;
create policy "Users can insert own stats." on user_stats for insert with check (auth.uid() = user_id);

create table if not exists tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  text text not null,
  completed boolean default false,
  completed_at bigint,
  type text check (type in ('daily', 'weekly', 'monthly')),
  due_date text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table tasks enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users can view their own tasks.') then
    drop policy "Users can view their own tasks." on tasks;
  end if;
end $$;
create policy "Users can view their own tasks." on tasks for select using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users can insert their own tasks.') then
    drop policy "Users can insert their own tasks." on tasks;
  end if;
end $$;
create policy "Users can insert their own tasks." on tasks for insert with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users can update their own tasks.') then
    drop policy "Users can update their own tasks." on tasks;
  end if;
end $$;
create policy "Users can update their own tasks." on tasks for update using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users can delete their own tasks.') then
    drop policy "Users can delete their own tasks." on tasks;
  end if;
end $$;
create policy "Users can delete their own tasks." on tasks for delete using (auth.uid() = user_id);

create table if not exists user_unlocks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  item_id text not null,
  type text check (type in ('theme', 'achievement')),
  claimed boolean not null default false,
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, item_id, type)
);

alter table user_unlocks add column if not exists claimed boolean not null default false;

alter table user_unlocks enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_unlocks' and policyname = 'Users can view their own unlocks.') then
    drop policy "Users can view their own unlocks." on user_unlocks;
  end if;
end $$;
create policy "Users can view their own unlocks." on user_unlocks for select using (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_unlocks' and policyname = 'Users can insert their own unlocks.') then
    drop policy "Users can insert their own unlocks." on user_unlocks;
  end if;
end $$;
create policy "Users can insert their own unlocks." on user_unlocks for insert with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'user_unlocks' and policyname = 'Users can update their own unlocks.') then
    drop policy "Users can update their own unlocks." on user_unlocks;
  end if;
end $$;
create policy "Users can update their own unlocks." on user_unlocks for update using (auth.uid() = user_id);

create table if not exists friendships (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  friend_id uuid references profiles(id) not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

alter table friendships enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'Friendships are viewable by involved parties.') then
    drop policy "Friendships are viewable by involved parties." on friendships;
  end if;
end $$;
create policy "Friendships are viewable by involved parties." on friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'Users can create friend requests.') then
    drop policy "Users can create friend requests." on friendships;
  end if;
end $$;
create policy "Users can create friend requests." on friendships for insert with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'friendships' and policyname = 'Users can update their friendships.') then
    drop policy "Users can update their friendships." on friendships;
  end if;
end $$;
create policy "Users can update their friendships." on friendships for update using (auth.uid() = user_id or auth.uid() = friend_id);

create table if not exists lobbies (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null,
  name text not null,
  owner_id uuid references profiles(id) not null,
  status text check (status in ('waiting', 'setup', 'playing', 'finished')) default 'waiting',
  setup_ends_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table lobbies enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobbies' and policyname = 'Lobbies are viewable by everyone.') then
    drop policy "Lobbies are viewable by everyone." on lobbies;
  end if;
end $$;
create policy "Lobbies are viewable by everyone." on lobbies for select using (true);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobbies' and policyname = 'Authenticated users can create lobbies.') then
    drop policy "Authenticated users can create lobbies." on lobbies;
  end if;
end $$;
create policy "Authenticated users can create lobbies." on lobbies for insert with check (auth.role() = 'authenticated');

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobbies' and policyname = 'Owners can update their lobbies.') then
    drop policy "Owners can update their lobbies." on lobbies;
  end if;
end $$;
create policy "Owners can update their lobbies." on lobbies for update using (auth.uid() = owner_id);

create table if not exists lobby_members (
  lobby_id uuid references lobbies(id) not null,
  user_id uuid references profiles(id) not null,
  team integer,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (lobby_id, user_id)
);

alter table lobby_members enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobby_members' and policyname = 'Lobby members are viewable by everyone.') then
    drop policy "Lobby members are viewable by everyone." on lobby_members;
  end if;
end $$;
create policy "Lobby members are viewable by everyone." on lobby_members for select using (true);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobby_members' and policyname = 'Users can join lobbies.') then
    drop policy "Users can join lobbies." on lobby_members;
  end if;
end $$;
create policy "Users can join lobbies." on lobby_members for insert with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'lobby_members' and policyname = 'Users can leave lobbies.') then
    drop policy "Users can leave lobbies." on lobby_members;
  end if;
end $$;
create policy "Users can leave lobbies." on lobby_members for delete using (auth.uid() = user_id);

create table if not exists games (
  id uuid default uuid_generate_v4() primary key,
  game_type text check (game_type in ('tictactoe', 'rps', 'samurai')) not null,
  lobby_id uuid references lobbies(id),
  player1_id uuid references auth.users not null,
  player2_id uuid references auth.users not null,
  current_turn uuid references auth.users,
  state jsonb default '{}'::jsonb,
  state_json jsonb default '{}'::jsonb,
  turn_index integer default 0,
  turn_ends_at timestamp with time zone,
  setup_ends_at timestamp with time zone,
  p1_penalties integer default 0,
  p2_penalties integer default 0,
  status text check (status in ('waiting', 'setup', 'playing', 'finished', 'aborted')) default 'waiting',
  winner integer,
  winner_id uuid references auth.users,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table games add column if not exists lobby_id uuid references lobbies(id);
alter table games add column if not exists state_json jsonb default '{}'::jsonb;
alter table games add column if not exists turn_index integer default 0;
alter table games add column if not exists turn_ends_at timestamp with time zone;
alter table games add column if not exists setup_ends_at timestamp with time zone;
alter table games add column if not exists p1_penalties integer default 0;
alter table games add column if not exists p2_penalties integer default 0;
alter table games add column if not exists winner integer;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'games_game_type_check') then
    alter table games drop constraint games_game_type_check;
  end if;
end $$;
alter table games add constraint games_game_type_check check (game_type in ('tictactoe', 'rps', 'samurai'));

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'games_status_check') then
    alter table games drop constraint games_status_check;
  end if;
end $$;
alter table games add constraint games_status_check check (status in ('waiting', 'setup', 'playing', 'finished', 'aborted'));

alter table games enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'games' and policyname = 'Players can view their own games.') then
    drop policy "Players can view their own games." on games;
  end if;
end $$;
create policy "Players can view their own games." on games for select using (auth.uid() = player1_id or auth.uid() = player2_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'games' and policyname = 'Samurai games are viewable by everyone.') then
    drop policy "Samurai games are viewable by everyone." on games;
  end if;
end $$;
create policy "Samurai games are viewable by everyone." on games for select using (game_type = 'samurai');

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'games' and policyname = 'Players can update their own games.') then
    drop policy "Players can update their own games." on games;
  end if;
end $$;
create policy "Players can update their own games." on games for update using (auth.uid() = player1_id or auth.uid() = player2_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'games' and policyname = 'Players can create games.') then
    drop policy "Players can create games." on games;
  end if;
end $$;
create policy "Players can create games." on games for insert with check (auth.uid() = player1_id or auth.uid() = player2_id);

create table if not exists game_invites (
  id uuid default uuid_generate_v4() primary key,
  sender_id uuid references auth.users not null,
  receiver_id uuid references auth.users not null,
  game_type text check (game_type in ('tictactoe', 'rps')) not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending',
  game_id uuid references games(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_invites_sender_profiles_fkey') then
    alter table game_invites add constraint game_invites_sender_profiles_fkey foreign key (sender_id) references profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_invites_receiver_profiles_fkey') then
    alter table game_invites add constraint game_invites_receiver_profiles_fkey foreign key (receiver_id) references profiles(id) on delete cascade;
  end if;
end $$;

alter table game_invites enable row level security;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'game_invites' and policyname = 'Users can view their invites.') then
    drop policy "Users can view their invites." on game_invites;
  end if;
end $$;
create policy "Users can view their invites." on game_invites for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'game_invites' and policyname = 'Users can create invites.') then
    drop policy "Users can create invites." on game_invites;
  end if;
end $$;
create policy "Users can create invites." on game_invites for insert with check (auth.uid() = sender_id);

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'game_invites' and policyname = 'Users can update their invites.') then
    drop policy "Users can update their invites." on game_invites;
  end if;
end $$;
create policy "Users can update their invites." on game_invites for update using (auth.uid() = sender_id or auth.uid() = receiver_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'Avatar images are publicly accessible.') then
    drop policy "Avatar images are publicly accessible." on storage.objects;
  end if;
end $$;
create policy "Avatar images are publicly accessible." on storage.objects for select using (bucket_id = 'avatars');

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'Anyone can upload an avatar.') then
    drop policy "Anyone can upload an avatar." on storage.objects;
  end if;
end $$;
create policy "Anyone can upload an avatar." on storage.objects for insert with check (bucket_id = 'avatars');

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'Anyone can update their own avatar.') then
    drop policy "Anyone can update their own avatar." on storage.objects;
  end if;
end $$;
create policy "Anyone can update their own avatar." on storage.objects for update using (auth.uid() = owner) with check (bucket_id = 'avatars');

create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_stats_updated on user_stats;
create trigger on_stats_updated
  before update on user_stats
  for each row execute procedure handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, friend_code)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    upper(substring(md5(random()::text) from 1 for 6))
  );
  insert into public.user_stats (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function get_user_by_friend_code(code_input text)
returns table (id uuid, username text, avatar_url text) as $$
begin
  return query
  select p.id, p.username, p.avatar_url
  from profiles p
  where p.friend_code = upper(code_input);
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_stats') then
    alter publication supabase_realtime add table public.user_stats;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_invites') then
    alter publication supabase_realtime add table public.game_invites;
  end if;
end $$;

with expected_tables(table_name) as (
  values
    ('profiles'),
    ('user_stats'),
    ('tasks'),
    ('user_unlocks'),
    ('friendships'),
    ('lobbies'),
    ('lobby_members'),
    ('games'),
    ('game_invites')
)
select e.table_name as missing_table
from expected_tables e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.table_name
where t.table_name is null;

with expected_columns(table_name, column_name) as (
  values
    ('profiles', 'friend_code'),
    ('user_stats', 'active_theme_id'),
    ('user_stats', 'claimed_achievement_ids'),
    ('user_stats', 'unlocked_achievement_ids'),
    ('user_unlocks', 'claimed')
)
select e.table_name, e.column_name
from expected_columns e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
where c.column_name is null;

with expected_policies(table_name, policy_name) as (
  values
    ('profiles', 'Public profiles are viewable by everyone.'),
    ('profiles', 'Users can insert their own profile.'),
    ('profiles', 'Users can update own profile.'),
    ('user_stats', 'Stats are viewable by everyone.'),
    ('user_stats', 'Users can update own stats.'),
    ('user_stats', 'Users can insert own stats.'),
    ('tasks', 'Users can view their own tasks.'),
    ('tasks', 'Users can insert their own tasks.'),
    ('tasks', 'Users can update their own tasks.'),
    ('tasks', 'Users can delete their own tasks.'),
    ('user_unlocks', 'Users can view their own unlocks.'),
    ('user_unlocks', 'Users can insert their own unlocks.'),
    ('user_unlocks', 'Users can update their own unlocks.'),
    ('friendships', 'Friendships are viewable by involved parties.'),
    ('friendships', 'Users can create friend requests.'),
    ('friendships', 'Users can update their friendships.'),
    ('lobbies', 'Lobbies are viewable by everyone.'),
    ('lobbies', 'Authenticated users can create lobbies.'),
    ('lobbies', 'Owners can update their lobbies.'),
    ('lobby_members', 'Lobby members are viewable by everyone.'),
    ('lobby_members', 'Users can join lobbies.'),
    ('lobby_members', 'Users can leave lobbies.'),
    ('games', 'Players can view their own games.'),
    ('games', 'Players can update their own games.'),
    ('games', 'Players can create games.'),
    ('game_invites', 'Users can view their invites.'),
    ('game_invites', 'Users can create invites.'),
    ('game_invites', 'Users can update their invites.')
)
select e.table_name, e.policy_name
from expected_policies e
left join pg_policies p
  on p.schemaname = 'public' and p.tablename = e.table_name and p.policyname = e.policy_name
where p.policyname is null;

with expected_rls(table_name) as (
  values
    ('profiles'),
    ('user_stats'),
    ('tasks'),
    ('user_unlocks'),
    ('friendships'),
    ('lobbies'),
    ('lobby_members'),
    ('games'),
    ('game_invites')
)
select e.table_name
from expected_rls e
join pg_class c on c.relname = e.table_name
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relrowsecurity = false;

with expected_realtime(table_name) as (
  values
    ('user_stats'),
    ('games'),
    ('game_invites')
)
select e.table_name as missing_realtime
from expected_realtime e
left join pg_publication_tables t
  on t.pubname = 'supabase_realtime' and t.schemaname = 'public' and t.tablename = e.table_name
where t.tablename is null;
