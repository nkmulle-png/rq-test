-- Wipe old data
DELETE FROM public.enrollments;
DELETE FROM public.courses;
DELETE FROM public.topics;
DELETE FROM public.app_users;

-- Convert tier columns from enum to text (enum can't hold new values cleanly mid-tx)
ALTER TABLE public.app_users ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.topics    ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.courses   ALTER COLUMN platform TYPE text USING platform::text;

DROP TYPE IF EXISTS public.user_tier;
DROP TYPE IF EXISTS public.course_platform;

-- Drop login_info from courses (moving to dedicated table)
ALTER TABLE public.courses DROP COLUMN IF EXISTS login_info;

-- Create login_information table
CREATE TABLE public.login_information (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team text NOT NULL,
  platform text NOT NULL,
  username text,
  password text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.login_information TO authenticated;
GRANT ALL ON public.login_information TO service_role;
ALTER TABLE public.login_information ENABLE ROW LEVEL SECURITY;
CREATE POLICY login_information_select_auth ON public.login_information
  FOR SELECT TO authenticated USING (true);

-- Update is_manager_of so users with no manager_email (top of tree) see everyone
CREATE OR REPLACE FUNCTION public.is_manager_of(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.app_users me
      WHERE me.auth_user_id = auth.uid()
        AND (me.manager_email IS NULL OR btrim(me.manager_email) = '')
    )
    OR EXISTS (
      SELECT 1 FROM public.subordinate_ids(public.current_user_email()) s
      WHERE s.id = _target
    )
$$;

-- ===================== DATA LOAD =====================
-- (topics, courses, users, login_information rows below)
-- Topics
INSERT INTO public.topics (tier, name, sort_order) VALUES ('1-2 Years Experience','Critical Thinking with AI',0);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('1-2 Years Experience','Mentoring',1);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('1-2 Years Experience','Pharma/Med Device',2);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('1-2 Years Experience','Project Mgmt Soft Skills',3);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('1-2 Years Experience','Time Management/Productivity',4);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('2+ Years Experience','Adapting to Change',5);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('2+ Years Experience','Communication Skills',6);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('2+ Years Experience','Conflict Management',7);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('2+ Years Experience','Decision Making',8);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('2+ Years Experience','Pharma/Med Device',9);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With Direct Reports','Conflict Management',10);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With Direct Reports','Leadership Skills',11);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With Direct Reports','Mentoring',12);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With Direct Reports','Performance Conversations',13);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With Direct Reports','Strategic Thinking',14);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With No Direct Reports','Decision Making',15);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With No Direct Reports','Influence Without Authority',16);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With No Direct Reports','Leadership Skills',17);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With No Direct Reports','Strategic Thinking',18);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Leader With No Direct Reports','Time Management/Productivity',19);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('New Hire','Active Listening',20);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('New Hire','Critical Thinking',21);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('New Hire','Pharma/Med Device',22);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('New Hire','Productivity & Organization',23);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('New Hire','Relationship Building',24);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Senior Leadership','Coaching Leaders',25);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Senior Leadership','Executive Presence',26);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Senior Leadership','Leading Through Change',27);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Senior Leadership','Org Strategy & Vision',28);
INSERT INTO public.topics (tier, name, sort_order) VALUES ('Senior Leadership','Strategic Communication',29);
