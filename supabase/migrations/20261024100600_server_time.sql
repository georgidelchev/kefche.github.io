-- The database's clock, for browsers to line up with (Phase 5 step 10): a
-- race starts for everyone at settings.startedAt + the countdown, on this
-- clock, whatever each device's own clock says.
create function public.server_time()
returns bigint
language sql
volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

revoke execute on function public.server_time() from public;
grant execute on function public.server_time() to anon, authenticated;
