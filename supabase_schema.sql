-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES: Public user data
create table profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS) for Profiles
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- USER STATS: Points and Tasks count
create table user_stats (
  user_id uuid references profiles(id) not null primary key,
  points integer default 0,
  total_points integer default 0,
  tasks_completed_daily integer default 0,
  tasks_completed_weekly integer default 0,
  tasks_completed_monthly integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table user_stats enable row level security;
create policy "Stats are viewable by everyone." on user_stats for select using (true);
create policy "Users can update own stats." on user_stats for update using (auth.uid() = user_id);
create policy "Users can insert own stats." on user_stats for insert with check (auth.uid() = user_id);

-- LOBBIES: Permanent groups (Guilds/Clans)
create table lobbies (
  id uuid default uuid_generate_v4() primary key,
  code text unique not null, -- Short code for invites
  name text not null,
  owner_id uuid references profiles(id) not null,
  status text check (status in ('waiting', 'setup', 'playing', 'finished')) default 'waiting',
  setup_ends_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table lobbies enable row level security;
create policy "Lobbies are viewable by everyone." on lobbies for select using (true);
create policy "Authenticated users can create lobbies." on lobbies for insert with check (auth.role() = 'authenticated');
create policy "Owners can update their lobbies." on lobbies for update using (auth.uid() = owner_id);

-- LOBBY MEMBERS
create table lobby_members (
  lobby_id uuid references lobbies(id) not null,
  user_id uuid references profiles(id) not null,
  team integer,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (lobby_id, user_id)
);

alter table lobby_members enable row level security;
create policy "Lobby members are viewable by everyone." on lobby_members for select using (true);
create policy "Users can join lobbies." on lobby_members for insert with check (auth.uid() = user_id);
create policy "Users can leave lobbies." on lobby_members for delete using (auth.uid() = user_id);

-- FRIENDSHIPS
create table friendships (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) not null,
  friend_id uuid references profiles(id) not null,
  status text check (status in ('pending', 'accepted')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, friend_id)
);

alter table friendships enable row level security;
create policy "Friendships are viewable by involved parties." on friendships for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users can create friend requests." on friendships for insert with check (auth.uid() = user_id);
create policy "Users can update their friendships." on friendships for update using (auth.uid() = user_id or auth.uid() = friend_id);

-- Functions to update updated_at on stats change
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_stats_updated
  before update on user_stats
  for each row execute procedure handle_updated_at();

-- Function to handle new user signup (Trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  
  insert into public.user_stats (user_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
