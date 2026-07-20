CREATE POLICY enrollments_delete_self_not_completed
ON public.enrollments
FOR DELETE
TO authenticated
USING (app_user_id = public.current_app_user_id() AND completed_at IS NULL);