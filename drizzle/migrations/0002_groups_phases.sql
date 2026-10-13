CREATE TYPE public.match_phase AS ENUM ('grupos','cruce','semifinal','final');
ALTER TABLE public.teams ADD COLUMN group_name text;
ALTER TABLE public.matches ADD COLUMN group_name text;
ALTER TABLE public.matches ADD COLUMN phase public.match_phase NOT NULL DEFAULT 'grupos';
ALTER TABLE public.matches ADD COLUMN bracket_slot integer NOT NULL DEFAULT 1;