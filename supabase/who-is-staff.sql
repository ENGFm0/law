-- Who holds the desk, and who does not. Run in the Supabase SQL editor when
-- the site says a page is for staff and you believed you were staff — the
-- usual answer is that you are signed in as a different account.
select u.email,
       p.full_name,
       p.roles,
       p.active_role,
       p.status,
       p.onboarded,
       ('staff' = any(p.roles)) as is_staff
  from public.profiles p
  join auth.users u on u.id = p.id
 order by is_staff desc, u.email;
