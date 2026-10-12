CREATE TYPE public.app_role AS ENUM ('admin', 'planillero');
CREATE TYPE public.category AS ENUM ('varonil', 'femenil', 'mixto');
CREATE TYPE public.match_status AS ENUM ('programado', 'en_vivo', 'final');
CREATE TYPE public.event_type AS ENUM ('td', 'conv1', 'conv2', 'safety', 'int', 'sack');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_score(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','planillero'))
$$;

-- First registered user becomes admin + planillero
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'), (NEW.id, 'planillero');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text NOT NULL,
  category public.category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read teams" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage teams" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.category NOT NULL,
  home_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  field text NOT NULL DEFAULT 'Campo 1',
  round int NOT NULL DEFAULT 1,
  status public.match_status NOT NULL DEFAULT 'programado',
  home_score int NOT NULL DEFAULT 0,
  away_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read matches" ON public.matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Scorers update matches" ON public.matches FOR UPDATE TO authenticated
  USING (public.can_score(auth.uid())) WITH CHECK (public.can_score(auth.uid()));
CREATE POLICY "Admins insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete matches" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  jersey int NOT NULL CHECK (jersey >= 0 AND jersey <= 99),
  event_type public.event_type NOT NULL,
  points int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.match_events (match_id);
GRANT SELECT ON public.match_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON public.match_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Scorers insert events" ON public.match_events FOR INSERT TO authenticated WITH CHECK (public.can_score(auth.uid()));
CREATE POLICY "Scorers delete events" ON public.match_events FOR DELETE TO authenticated USING (public.can_score(auth.uid()));

-- IFAF 2023 points per event
CREATE OR REPLACE FUNCTION public.set_event_points()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.points := CASE NEW.event_type
    WHEN 'td' THEN 6 WHEN 'conv1' THEN 1 WHEN 'conv2' THEN 2 WHEN 'safety' THEN 2 ELSE 0 END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_event_points BEFORE INSERT OR UPDATE ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.set_event_points();

CREATE OR REPLACE FUNCTION public.recompute_match_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid := COALESCE(NEW.match_id, OLD.match_id);
BEGIN
  UPDATE public.matches m SET
    home_score = COALESCE((SELECT sum(points) FROM public.match_events e WHERE e.match_id = mid AND e.team_id = m.home_team_id), 0),
    away_score = COALESCE((SELECT sum(points) FROM public.match_events e WHERE e.match_id = mid AND e.team_id = m.away_team_id), 0)
  WHERE m.id = mid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_recompute_score AFTER INSERT OR UPDATE OR DELETE ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.recompute_match_score();

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;

-- Seed teams
INSERT INTO public.teams (id, name, short_name, category) VALUES
('00000000-0000-0000-0000-000000000001','Halcones del Norte','HAL','varonil'),
('00000000-0000-0000-0000-000000000002','Toros Rojos','TOR','varonil'),
('00000000-0000-0000-0000-000000000003','Lobos Grises','LOB','varonil'),
('00000000-0000-0000-0000-000000000004','Jaguares FC','JAG','varonil'),
('00000000-0000-0000-0000-000000000011','Valkirias','VAL','femenil'),
('00000000-0000-0000-0000-000000000012','Panteras','PAN','femenil'),
('00000000-0000-0000-0000-000000000013','Águilas Doradas','AGU','femenil'),
('00000000-0000-0000-0000-000000000014','Fénix','FNX','femenil'),
('00000000-0000-0000-0000-000000000021','Rayos','RAY','mixto'),
('00000000-0000-0000-0000-000000000022','Cometas','COM','mixto'),
('00000000-0000-0000-0000-000000000023','Titanes','TIT','mixto'),
('00000000-0000-0000-0000-000000000024','Coyotes','COY','mixto');

-- Seed round robin: rounds 1-2 final, round 3 scheduled
DO $$
DECLARE
  cats text[] := ARRAY['varonil','femenil','mixto'];
  bases int[] := ARRAY[0,10,20];
  pairs int[][] := ARRAY[[1,2],[3,4],[1,3],[2,4],[1,4],[2,3]];
  i int; p int; h uuid; a uuid; mid uuid; st public.match_status; r int; k int; side uuid;
BEGIN
  FOR i IN 1..3 LOOP
    FOR p IN 1..6 LOOP
      h := ('00000000-0000-0000-0000-0000000000' || lpad((bases[i] + pairs[p][1])::text, 2, '0'))::uuid;
      a := ('00000000-0000-0000-0000-0000000000' || lpad((bases[i] + pairs[p][2])::text, 2, '0'))::uuid;
      r := ((p - 1) / 2) + 1;
      st := CASE WHEN r < 3 THEN 'final'::public.match_status ELSE 'programado'::public.match_status END;
      INSERT INTO public.matches (category, home_team_id, away_team_id, scheduled_at, field, round, status)
      VALUES (cats[i]::public.category, h, a,
        date_trunc('day', now()) + ((r - 2) * interval '7 days') + interval '16 hours' + ((p % 2) * interval '1 hour') + ((i - 1) * interval '2 hours'),
        'Campo ' || ((p % 2) + 1), r, st)
      RETURNING id INTO mid;
      IF st = 'final' THEN
        FOR k IN 1..(3 + floor(random() * 5)::int) LOOP
          side := CASE WHEN random() < 0.5 THEN h ELSE a END;
          INSERT INTO public.match_events (match_id, team_id, jersey, event_type)
            VALUES (mid, side, (ARRAY[1,3,7,10,12,22,88])[1 + floor(random()*7)::int], 'td');
          IF random() < 0.7 THEN
            INSERT INTO public.match_events (match_id, team_id, jersey, event_type)
              VALUES (mid, side, (ARRAY[1,7,12])[1 + floor(random()*3)::int], CASE WHEN random() < 0.6 THEN 'conv1'::public.event_type ELSE 'conv2'::public.event_type END);
          END IF;
        END LOOP;
        FOR k IN 1..(1 + floor(random() * 3)::int) LOOP
          INSERT INTO public.match_events (match_id, team_id, jersey, event_type)
            VALUES (mid, CASE WHEN random() < 0.5 THEN h ELSE a END, (ARRAY[5,9,21,24,33])[1 + floor(random()*5)::int], CASE WHEN random() < 0.5 THEN 'int'::public.event_type ELSE 'sack'::public.event_type END);
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;