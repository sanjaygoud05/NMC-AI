## Problem

The `demo@kb.app` account only holds the `employee` role, so the UI correctly hides:
- The role switcher (needs 2+ roles)
- All-requests view, Pending Approvals, User Management, Settings (need manager/admin)
- Request type CRUD (admin only)

This makes the app look like a single-row read-only list, when it's actually a full role-based CRUD tool.

## Fix

Run a data migration that grants the demo account both `admin` and `manager` roles in addition to `employee`:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (VALUES ('admin'::app_role), ('manager'::app_role)) AS r(role)
WHERE u.email = 'demo@kb.app'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Result

After re-login (or refresh), the demo account will:
1. Show a **Role: Admin/Manager/Employee** switcher in the top bar
2. See all 8 seeded requests in **All Requests** (admin view)
3. Access **Pending Approvals** with Approve / Reject / Request Changes actions
4. Access **Admin → User Management** and **Admin → Settings** (request type CRUD with the visual form schema builder)

No code changes needed — the role-based UI is already wired correctly; it just needs the right grants on the demo account.

## Optional follow-up

If you'd also like the seed to *guarantee* the demo account always lands as admin (e.g. for future remixes), I can update `seed_demo_data()` / `handle_new_user()` so the first user with email `demo@kb.app` is auto-promoted. Say the word and I'll add it.
