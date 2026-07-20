DROP POLICY IF EXISTS login_information_select_auth ON public.login_information;

CREATE POLICY login_information_select_roster
ON public.login_information
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE lower(u.email) = public.current_user_email()
  )
);