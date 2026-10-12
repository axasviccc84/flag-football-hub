ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'pass_td';

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  gender public.category NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.can_score(auth.uid())) WITH CHECK (public.can_score(auth.uid()));

INSERT INTO public.categories (id, name, gender, sort_order) VALUES
('10000000-0000-0000-0000-000000000001','Varonil Libre','varonil',1),
('10000000-0000-0000-0000-000000000002','Femenil Libre','femenil',2),
('10000000-0000-0000-0000-000000000003','U10 Mixto','mixto',3);

ALTER TABLE public.teams ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;
ALTER TABLE public.matches ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;
UPDATE public.teams SET category_id = CASE category WHEN 'varonil' THEN '10000000-0000-0000-0000-000000000001'::uuid WHEN 'femenil' THEN '10000000-0000-0000-0000-000000000002'::uuid ELSE '10000000-0000-0000-0000-000000000003'::uuid END;
UPDATE public.matches SET category_id = CASE category WHEN 'varonil' THEN '10000000-0000-0000-0000-000000000001'::uuid WHEN 'femenil' THEN '10000000-0000-0000-0000-000000000002'::uuid ELSE '10000000-0000-0000-0000-000000000003'::uuid END;
CREATE INDEX ON public.teams(category_id);
CREATE INDEX ON public.matches(category_id);

-- keep legacy gender column in sync from category_id
CREATE OR REPLACE FUNCTION public.sync_category_gender()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT gender INTO NEW.category FROM public.categories WHERE id = NEW.category_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_team_cat BEFORE INSERT OR UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.sync_category_gender();
CREATE TRIGGER trg_match_cat BEFORE INSERT OR UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.sync_category_gender();

CREATE OR REPLACE FUNCTION public.sync_teams_on_category()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    UPDATE public.teams SET category = NEW.gender WHERE category_id = NEW.id;
    UPDATE public.matches SET category = NEW.gender WHERE category_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_category_gender AFTER UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.sync_teams_on_category();

DROP POLICY "Admins manage teams" ON public.teams;
CREATE POLICY "Staff manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.can_score(auth.uid())) WITH CHECK (public.can_score(auth.uid()));

COMMENT ON COLUMN public.teams.category IS 'DEPRECATED: gender mirror of category_id';
COMMENT ON COLUMN public.matches.category IS 'DEPRECATED: gender mirror of category_id';
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories, public.teams;