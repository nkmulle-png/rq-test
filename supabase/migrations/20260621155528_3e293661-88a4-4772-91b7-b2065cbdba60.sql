
-- Replace the self-update policy with a WITH CHECK that locks sensitive columns
DROP POLICY IF EXISTS app_users_update_self_authlink ON public.app_users;

CREATE POLICY app_users_update_self_authlink
ON public.app_users
FOR UPDATE
TO authenticated
USING (lower(email) = public.current_user_email())
WITH CHECK (
  lower(email) = public.current_user_email()
  AND is_admin       = (SELECT u.is_admin       FROM public.app_users u WHERE u.id = public.current_app_user_id())
  AND tier           IS NOT DISTINCT FROM (SELECT u.tier           FROM public.app_users u WHERE u.id = public.current_app_user_id())
  AND manager_email  IS NOT DISTINCT FROM (SELECT u.manager_email  FROM public.app_users u WHERE u.id = public.current_app_user_id())
  AND department     IS NOT DISTINCT FROM (SELECT u.department     FROM public.app_users u WHERE u.id = public.current_app_user_id())
  AND title          IS NOT DISTINCT FROM (SELECT u.title          FROM public.app_users u WHERE u.id = public.current_app_user_id())
);

-- Admin-only policy for changes to privileged columns
CREATE POLICY app_users_update_admin
ON public.app_users
FOR UPDATE
TO authenticated
USING (public.current_user_is_admin())
WITH CHECK (public.current_user_is_admin());
