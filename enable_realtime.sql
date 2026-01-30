-- Enable Realtime for user_stats table
-- This is required for the FriendsPage to receive live updates
begin;
  -- Check if publication exists (Supabase default)
  -- Add user_stats to the publication
  alter publication supabase_realtime add table user_stats;
commit;
