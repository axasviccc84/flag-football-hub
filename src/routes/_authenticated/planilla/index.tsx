import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allTeamsQuery, matchesQuery, CATEGORIES, useLiveTournament } from "@/lib/tournament";
import { MatchCard } from "@/components/MatchCard";
import { useScorerRole } from "@/lib/use-scorer";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/planilla/")({
  head: () => ({
    meta: [
      { title: "Panel de Planilleros · Torneo Flag Football" },
      { name: "description", content: "Selecciona un partido para capturar marcador y eventos por jersey." },
      { property: "og:title", content: "Panel de Planilleros" },
      { property: "og:description", content: "Captura en campo del torneo de Flag Football." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScorerHome,
});

function ScorerHome() {
  const { user } = Route.useRouteContext();
  useLiveTournament();
  const role = useQuery({ ...{ queryKey: ["noop"] }, enabled: false });
  void role;
  const scorer = useScorerRole(user.id);
  const teams = useQuery(allTeamsQuery());
  const matches = useQuery(matchesQuery());
  const teamMap = new Map((teams.data ?? []).map((t) => [t.id, t]));

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Panel de captura</h1>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut().then(() => location.assign("/"))}>Salir</Button>
      </div>
      {scorer.data === false && (
        <div className="rounded-xl border border-destructive bg-card p-4 text-sm">
          Tu cuenta ({user.email}) aún no tiene permiso de planillero. Pide al administrador que te lo asigne.
        </div>
      )}
      {CATEGORIES.map((c) => {
        const list = (matches.data ?? []).filter((m) => m.category === c.value);
        return (
          <div key={c.value}>
            <h2 className="mb-3 text-2xl text-primary">{c.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((m) => (
                <Link key={m.id} to="/planilla/$matchId" params={{ matchId: m.id }} className="block transition-transform hover:-translate-y-0.5">
                  <MatchCard match={m} teams={teamMap} />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
