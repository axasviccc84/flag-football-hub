DROP TRIGGER IF EXISTS trg_advance_bracket ON public.matches;
CREATE TRIGGER trg_advance_bracket AFTER INSERT OR UPDATE OF status, home_score, away_score ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.advance_bracket();