ALTER TABLE public.app_users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE auth_user_id = auth.uid()
      AND is_admin = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.app_users me
      WHERE me.auth_user_id = auth.uid()
        AND (me.manager_email IS NULL OR btrim(me.manager_email) = '')
    )
    OR EXISTS (
      SELECT 1 FROM public.subordinate_ids(public.current_user_email()) s
      WHERE s.id = _target
    )
$$;