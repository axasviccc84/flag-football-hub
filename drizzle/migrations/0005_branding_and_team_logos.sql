CREATE TABLE public.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  tournament_name text NOT NULL DEFAULT 'FlagTorneo',
  primary_color text NOT NULL DEFAULT '#f97316',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.settings TO anon;
GRANT SELECT ON public.settings TO authenticated;
GRANT UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings"
ON public.settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins update settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.teams ADD COLUMN logo_url text;

CREATE POLICY "Staff upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos' AND public.can_score(auth.uid()));

CREATE POLICY "Staff update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND public.can_score(auth.uid()))
WITH CHECK (bucket_id = 'logos' AND public.can_score(auth.uid()));

CREATE POLICY "Staff delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND public.can_score(auth.uid()));

CREATE POLICY "Public read logos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'logos');