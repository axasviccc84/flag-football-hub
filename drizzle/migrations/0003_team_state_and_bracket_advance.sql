ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bye_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.advance_bracket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  semis_total int; semis_open int; s1 record; s2 record;
  w1 uuid; w2 uuid; fid uuid;
BEGIN
  IF NEW.phase <> 'semifinal' OR NEW.status <> 'final' THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE status <> 'final' OR home_score = away_score)
    INTO semis_total, semis_open FROM matches WHERE category_id = NEW.category_id AND phase = 'semifinal';
  IF semis_open > 0 THEN RETURN NEW; END IF;
  SELECT * INTO s1 FROM matches WHERE category_id = NEW.category_id AND phase = 'semifinal' ORDER BY bracket_slot, created_at LIMIT 1;
  w1 := CASE WHEN s1.home_score > s1.away_score THEN s1.home_team_id ELSE s1.away_team_id END;
  IF semis_total = 1 THEN
    IF s1.bye_team_id IS NULL THEN RETURN NEW; END IF;
    w2 := w1; w1 := s1.bye_team_id;
  ELSE
    SELECT * INTO s2 FROM matches WHERE category_id = NEW.category_id AND phase = 'semifinal' AND id <> s1.id ORDER BY bracket_slot, created_at LIMIT 1;
    w2 := CASE WHEN s2.home_score > s2.away_score THEN s2.home_team_id ELSE s2.away_team_id END;
  END IF;
  SELECT id INTO fid FROM matches WHERE category_id = NEW.category_id AND phase = 'final' LIMIT 1;
  IF fid IS NULL THEN
    INSERT INTO matches (category, category_id, home_team_id, away_team_id, scheduled_at, field, round, phase, bracket_slot)
    VALUES (NEW.category, NEW.category_id, w1, w2, NEW.scheduled_at + interval '2 hours', NEW.field, NEW.round + 1, 'final', 1);
  ELSE
    UPDATE matches SET home_team_id = w1, away_team_id = w2 WHERE id = fid AND status = 'programado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_advance_bracket ON public.matches;
CREATE TRIGGER trg_advance_bracket AFTER UPDATE OF status, home_score, away_score ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.advance_bracket();