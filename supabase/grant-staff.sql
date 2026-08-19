-- ===========================================================================
--  Make one account a member of platform staff.
--
--  Staff is the one role the platform never hands out through the product:
--  approving licences, ruling on disputes and setting the commission are all
--  decided here, and an account that could grant itself the role could grant
--  itself all three. So guard_roles() refuses it on any request that carries a
--  signed-in user, and the only path left is this one — the SQL editor, where
--  there is no user and somebody with the database in front of them is making
--  a deliberate choice.
--
--  Run migrations 002 and 003 first. Then replace the address below with your
--  own — it appears once — and run this in the Supabase SQL editor.
--
--  Plain SQL on purpose: the editor talks to the server directly and knows
--  nothing of psql's backslash commands.
--
--  Safe to run twice. It prints the account it changed; no rows back means the
--  address matched nothing, so sign in through the site once first and the
--  account will exist to promote.
-- ===========================================================================

update public.profiles p
   set roles       = case when 'staff' = any(p.roles)
                          then p.roles
                          else array_append(p.roles, 'staff') end,
       active_role = 'staff',
       status      = 'verified'
  from auth.users u
 where u.id = p.id
   and lower(u.email) = lower('you@example.com')   -- ← your email, here only
returning p.id, p.full_name, p.roles, p.active_role, p.status;
