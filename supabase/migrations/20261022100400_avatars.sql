-- Avatar uploads (SPEC §7.2): registered users whose account is at least 24 h
-- old may upload one image, resized in the browser to 256×256 and re-encoded
-- (which drops EXIF). Stored in the public `avatars` bucket as
-- "<user id>/<random>.webp" (JPEG where the browser can't encode WebP).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/webp', 'image/jpeg']);

-- Registered (not a guest) and the account is at least 24 hours old.
create function public.avatar_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and not coalesce(u.is_anonymous, false)
      and u.created_at <= now() - interval '24 hours'
  );
$$;

revoke execute on function public.avatar_upload_allowed() from public, anon;
grant execute on function public.avatar_upload_allowed() to authenticated;

-- Objects live at "<owner id>/<uuid>.(webp|jpg)".
create policy "Avatar uploads go to the user's own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
  and (select public.avatar_upload_allowed())
);

create policy "Users list their own avatar files"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own avatar files"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
