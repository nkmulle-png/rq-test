
-- Tier enum
CREATE TYPE public.user_tier AS ENUM (
  'New Hire',
  '1-2 Years',
  '2+ Years',
  'Leaders Without Direct Reports',
  'Leaders With Direct Reports',
  'Senior Leadership'
);

CREATE TYPE public.course_platform AS ENUM (
  'LinkedIn Learning',
  'Coursera',
  'MasterClass',
  'Simon Sinek'
);

-- Roster of people in the program
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  tier public.user_tier NOT NULL,
  manager_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_users_manager_email ON public.app_users(lower(manager_email));
CREATE INDEX idx_app_users_email_lower ON public.app_users(lower(email));

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.user_tier NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  platform public.course_platform NOT NULL,
  duration_minutes int NOT NULL DEFAULT 0,
  thumbnail_url text,
  course_url text,
  login_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  committed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  UNIQUE (app_user_id, topic_id)
);

-- Helper: app_user for current auth user (matched by email)
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.app_users
  WHERE auth_user_id = auth.uid()
     OR lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  LIMIT 1
$$;

-- Helper: current user's email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid()
$$;

-- Recursive set of app_user ids reporting (directly or indirectly) to a given manager email
CREATE OR REPLACE FUNCTION public.subordinate_ids(_manager_email text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT u.id, u.email
    FROM public.app_users u
    WHERE lower(u.manager_email) = lower(_manager_email)
    UNION
    SELECT u.id, u.email
    FROM public.app_users u
    JOIN tree t ON lower(u.manager_email) = lower(t.email)
  )
  SELECT id FROM tree
$$;

-- Is the current user a manager (anywhere in tree) of target_app_user_id?
CREATE OR REPLACE FUNCTION public.is_manager_of(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subordinate_ids(public.current_user_email()) s
    WHERE s.id = _target
  )
$$;

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Catalog is readable to all authenticated users
CREATE POLICY "topics_select_auth" ON public.topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_select_auth" ON public.courses
  FOR SELECT TO authenticated USING (true);

-- app_users: self + subordinates
CREATE POLICY "app_users_select_self_or_reports" ON public.app_users
  FOR SELECT TO authenticated USING (
    id = public.current_app_user_id()
    OR public.is_manager_of(id)
  );
CREATE POLICY "app_users_update_self_authlink" ON public.app_users
  FOR UPDATE TO authenticated USING (
    lower(email) = public.current_user_email()
  ) WITH CHECK (
    lower(email) = public.current_user_email()
  );

-- enrollments: self can do everything for own rows; managers can select & update reports
CREATE POLICY "enrollments_select_self_or_reports" ON public.enrollments
  FOR SELECT TO authenticated USING (
    app_user_id = public.current_app_user_id()
    OR public.is_manager_of(app_user_id)
  );
CREATE POLICY "enrollments_insert_self" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK (
    app_user_id = public.current_app_user_id()
  );
CREATE POLICY "enrollments_update_self_or_manager" ON public.enrollments
  FOR UPDATE TO authenticated USING (
    app_user_id = public.current_app_user_id()
    OR public.is_manager_of(app_user_id)
  ) WITH CHECK (
    app_user_id = public.current_app_user_id()
    OR public.is_manager_of(app_user_id)
  );
CREATE POLICY "enrollments_delete_manager" ON public.enrollments
  FOR DELETE TO authenticated USING (
    public.is_manager_of(app_user_id)
  );

-- Trigger to link auth_user_id on first login (if app_user exists by email)
CREATE OR REPLACE FUNCTION public.link_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.app_users
  SET auth_user_id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND (auth_user_id IS NULL OR auth_user_id <> NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_auth_user();
