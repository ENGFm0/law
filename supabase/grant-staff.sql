-- ===========================================================================
--  Make one account a member of platform staff.
--
--  Staff is the one role the platform never hands out through the product:
--  approving licences, ruling on disputes and setting the commission are all
--  decided here, and an account that could grant itself the role could grant
--  itself all three. So guard_roles() refuses it on any request carrying a
--  signed-in user, and the only path left is this one — the SQL editor, where
--  there is no user and somebody with the database in front of them is making
--  a deliberate choice.
--
--  Run migrations 002 to 005 first. Then put your own address below — it
--  appears once — and run this in the Supabase SQL editor.
--
--  It always returns exactly one row saying what happened, because the earlier
--  version returned nothing at all when the address matched nothing, and
--  "no rows" reads far too much like "done".
-- ===========================================================================

with promoted as (
  update public.profiles p
     set roles       = case when 'staff' = any(p.roles)
                            then p.roles
                            else array_append(p.roles, 'staff') end,
         active_role = 'staff',
         status      = 'verified'
    from auth.users u
   where u.id = p.id
     and lower(u.email) = lower('you@example.com')   -- ← your email, here only
  returning p.full_name, p.roles
)
select case when count(*) = 0
            then 'NOTHING MATCHED — no account has that address. '
                 'Sign in through the site with it once, then run this again.'
            else 'DONE — ' || string_agg(full_name || ' is now ' || roles::text, ', ')
       end as result
  from promoted;
