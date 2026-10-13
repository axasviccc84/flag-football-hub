import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  allTeamsQuery, categoriesQuery, eventsByMatchQuery, matchesQuery, useLiveTournament,
  EVENT_LABELS, STATUS_LABELS, type EventType, type MatchStatus,
} from "@/lib/tournament";
import { useScorerRole } from "@/lib/use-scorer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planilla/$matchId")({
  head: () => ({
    meta: [
      { title: "Captura de Partido · Torneo Flag Football" },
      { name: "description", content: "Registro de marcador y eventos individuales por jersey." },
      { property: "og:title", content: "Captura de Partido" },
      { property: "og:description", content: "Planilla en campo con reglas IFAF 2023." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchCapture,
});

const EVENT_ORDER: EventType[] = ["td", "conv1", "conv2", "safety", "int", "sack", "pass_td"];

function MatchCapture() {
  const { matchId } = Route.useParams();
  const { user } = Route.useRouteContext();
  useLiveTournament();
  const qc = useQueryClient();
  const scorer = useScorerRole(user.id);
  const teams = useQuery(allTeamsQuery());
  const matches = useQuery(matchesQuery());
  const events = useQuery(eventsByMatchQuery(matchId));
  const cats = useQuery(categoriesQuery());
  const match = matches.data?.find((m) => m.id === matchId);
  const teamMap = new Map((teams.data ?? []).map((t) => [t.id, t]));

  const [side, setSide] = useState<"home" | "away">("home");
  const [jersey, setJersey] = useState("");
  const [qty, setQty] = useState(1);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
  };

  const addEvent = useMutation({
    mutationFn: async (type: EventType) => {
      if (!match) return;
      const n = Number(jersey);
      if (jersey === "" || !Number.isInteger(n) || n < 0 || n > 99) throw new Error("Ingresa un jersey válido (0–99)");
      const row = {
        match_id: match.id,
        team_id: side === "home" ? match.home_team_id : match.away_team_id,
        jersey: n, event_type: type, created_by: user.id,
      };
      const { error } = await supabase.from("match_events").insert(Array.from({ length: qty }, () => row));
      if (error) throw error;
    },
    onSuccess: (_d, type) => { toast.success(`${qty > 1 ? `${qty}× ` : ""}${EVENT_LABELS[type].label} · #${jersey}`); setJersey(""); setQty(1); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const removeEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const setStatus = useMutation({
    mutationFn: async (status: MatchStatus) => {
      const { error } = await supabase.from("matches").update({ status }).eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!match) return <p className="text-muted-foreground">Cargando partido…</p>;
  const home = teamMap.get(match.home_team_id);
  const away = teamMap.get(match.away_team_id);
  const canEdit = scorer.data === true;

  return (
    <section className="space-y-5">
      <Link to="/planilla" className="text-sm text-muted-foreground hover:text-foreground">← Partidos</Link>

      <div className="rounded-xl border border-border bg-field p-5">
        <div className="mb-2 text-center text-xs uppercase tracking-widest text-muted-foreground">
          {cats.data?.find((c) => c.id === match.category_id)?.name ?? match.category} · J{match.round} · {match.field} · <span className={cn(match.status === "en_vivo" && "text-live")}>{STATUS_LABELS[match.status]}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div className="font-semibold">{home?.name}</div>
          <div className="font-display text-6xl tabular">{match.home_score}<span className="mx-2 text-muted-foreground">–</span>{match.away_score}</div>
          <div className="font-semibold">{away?.name}</div>
        </div>
      </div>

      {!canEdit && scorer.isFetched && (
        <div className="rounded-xl border border-destructive bg-card p-4 text-sm">No tienes permiso de planillero para capturar.</div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["programado", "en_vivo", "final"] as MatchStatus[]).map((s) => (
          <Button key={s} variant={match.status === s ? "default" : "outline"} disabled={!canEdit || setStatus.isPending} onClick={() => setStatus.mutate(s)}>
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-2">
          {(["home", "away"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={cn(
                "rounded-lg border-2 px-3 py-3 font-display text-xl transition-colors",
                side === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {(s === "home" ? home : away)?.short_name} <span className="text-sm font-sans">{(s === "home" ? home : away)?.name}</span>
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs uppercase tracking-wider text-muted-foreground">Jersey # (para Pase de TD, el jersey del QB)</label>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={jersey}
          onChange={(e) => setJersey(e.target.value.replace(/\D/g, ""))}
          placeholder="00"
          className="mt-1 w-full rounded-lg border border-input bg-background py-3 text-center font-display text-5xl tabular outline-none focus:border-primary"
        />

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EVENT_ORDER.map((t) => (
            <Button
              key={t}
              variant={EVENT_LABELS[t].points > 0 ? "default" : "secondary"}
              className="h-16 flex-col gap-0"
              disabled={!canEdit || addEvent.isPending}
              onClick={() => addEvent.mutate(t)}
            >
              <span className="font-display text-2xl">{EVENT_LABELS[t].short}</span>
              <span className="text-xs opacity-80">{EVENT_LABELS[t].label}{EVENT_LABELS[t].points ? ` +${EVENT_LABELS[t].points}` : ""}</span>
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">IFAF 2023: TD 6 · Conversión desde 5 yd = 1 · desde 10 yd = 2 · Safety 2. El marcador se calcula automáticamente.</p>
      </div>

      <div>
        <h2 className="mb-2 text-2xl">Jugadas registradas</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {(events.data ?? []).length === 0 && <li className="p-4 text-sm text-muted-foreground">Aún no hay eventos.</li>}
          {(events.data ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-chalk font-display text-lg text-background">{e.jersey}</span>
                <span className="font-semibold">{EVENT_LABELS[e.event_type].label}</span>
                <span className="text-muted-foreground">{teamMap.get(e.team_id)?.short_name}</span>
              </span>
              {canEdit && (
                <button className="text-xs text-destructive hover:underline" onClick={() => removeEvent.mutate(e.id)}>Deshacer</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
