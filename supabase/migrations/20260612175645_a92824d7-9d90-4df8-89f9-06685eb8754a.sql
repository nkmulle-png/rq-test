CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE is_admin = true
      AND (
        auth_user_id = auth.uid()
        OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
      )
  )
$$;