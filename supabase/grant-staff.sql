-- ===========================================================================
--  Make one account a member of platform staff.
--
--  Staff is the one role the platform never hands out through the product:
--  approving licences, ruling on disputes and setting the commission are all
--  decided here, and an account that could grant itself the role could grant
--  itself all three. So `guard_roles()` refuses it on any request that carries
--  a signed-in user, and the only path left is this one — the SQL editor,
--  where there is no user and somebody with the database in front of them is
--  making a deliberate choice.
--
--  Run migrations 002 and 003 first. Then put your own address below and run
--  this in the Supabase SQL editor.
-- ===========================================================================

-- ↓↓↓ your email, the one you signed in with ↓↓↓
\set owner_email 'you@example.com'

update public.profiles
   set roles       = array_append(roles, 'staff'),
       active_role = 'staff',
       status      = 'verified'
 where id = (select id from auth.users where lower(email) = lower(:'owner_email'))
   and not ('staff' = any(roles));

-- What it did. An empty result means the address matched no account: sign in
-- through the site once first, so the account exists to be promoted.
select p.id, p.full_name, p.roles, p.active_role, p.status
  from public.profiles p
  join auth.users u on u.id = p.id
 where lower(u.email) = lower(:'owner_email');
