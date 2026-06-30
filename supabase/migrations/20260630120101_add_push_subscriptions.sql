create table public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Grant access to authenticated users
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Create RLS policies
create policy "Users can manage their own push subscriptions"
  on public.push_subscriptions
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );
