-- ---------------------------------------------------------------------------
-- Item photos move from the server's filesystem into Supabase Storage.
--
-- Writing to `public/uploads` only works on a host with a real disk. Vercel's
-- filesystem is read-only, so saving a photo there fails outright. Storage is
-- part of the same Supabase project the data already lives in, costs nothing
-- on the free plan, and survives every deploy.
--
-- The bucket is public-read: a photo of a packet of biscuits is not a secret,
-- filenames are UUIDs, and public read keeps the <img> src a plain URL with no
-- signing or expiry to manage. Writing is another matter - only an admin may
-- upload or delete, enforced here rather than in the upload action alone.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  true,
  8388608, -- 8 MB, matching MAX_IMAGE_BYTES in lib/image-storage.ts
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "item images: anyone may read" on storage.objects;
create policy "item images: anyone may read"
  on storage.objects for select
  to public
  using (bucket_id = 'item-images');

drop policy if exists "item images: admins may upload" on storage.objects;
create policy "item images: admins may upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item images: admins may replace" on storage.objects;
create policy "item images: admins may replace"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin())
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item images: admins may delete" on storage.objects;
create policy "item images: admins may delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin());
