import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { allTeamsQuery, categoriesQuery, computeStandings, matchesQuery, type Team } from "@/lib/tournament";
import { oddTwoGameCycle, rankingRounds, roundRobin, splitGroups, stateTag, type Pair } from "@/lib/generator";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";
type Mode = "rr" | "ranking" | "groups";

export function FormatWizard() {
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery());
  const teams = useQuery(allTeamsQuery());
  const matches = useQuery(matchesQuery());
  const [catId, setCatId] = useState("");
  const [mode, setMode] = useState<Mode | "">("");
  const [rounds, setRounds] = useState(3);
  const [groupCount, setGroupCount] = useState(2);
  const [start, setStart] = useState("");
  const [interval, setIntervalMin] = useState(60);
  const [fields, setFields] = useState(2);

  const effectiveCat = catId || cats.data?.[0]?.id || "";
  const cat = cats.data?.find((c) => c.id === effectiveCat);
  const catTeams = (teams.data ?? []).filter((t) => t.category_id === effectiveCat);
  const catMatches = (matches.data ?? []).filter((m) => m.category_id === effectiveCat);
  const n = catTeams.length;
  const small = n === 3 || n === 4;
  const effMode: Mode = small ? "rr" : mode || "ranking";

  const refresh = () => { qc.invalidateQueries({ queryKey: ["matches"] }); qc.invalidateQueries({ queryKey: ["teams"] }); };

  const generate = useMutation({
    mutationFn: async () => {
      if (!cat) throw new Error("Selecciona una categoría");
      if (n < 3) throw new Error("Se necesitan al menos 3 equipos");
      if (!start) throw new Error("Indica fecha y hora de inicio");
      if (catMatches.some((m) => m.phase === "grupos" || m.phase === "cruce"))
        throw new Error("Esta categoría ya tiene partidos de fase regular. Elimínalos primero.");
      let pairs: Pair[];
      if (effMode === "rr") pairs = roundRobin(catTeams);
      else if (effMode === "ranking") {
        if (n % 2 && rounds !== 2) throw new Error(`Con ${n} equipos (impar) usa 2 jornadas para que todos jueguen exactamente 2 partidos.`);
        pairs = n % 2 ? oddTwoGameCycle(catTeams) : rankingRounds(catTeams, rounds);
      }
      else {
        const groups = splitGroups(catTeams, groupCount);
        for (const [g, list] of groups) {
          const ids = list.map((t) => t.id);
          if (ids.length) {
            const { error } = await supabase.from("teams").update({ group_name: g }).in("id", ids);
            if (error) throw error;
          }
        }
        pairs = [...groups].flatMap(([g, list]) => roundRobin(list, g));
      }
      pairs.sort((a, b) => a.round - b.round || Number(!!a.adjust) - Number(!!b.adjust));
      const t0 = new Date(start).getTime();
      const rows = pairs.map((p, i) => ({
        category_id: cat.id, category: cat.gender, home_team_id: p.home.id, away_team_id: p.away.id,
        scheduled_at: new Date(t0 + Math.floor(i / fields) * interval * 60000).toISOString(),
        field: `Campo ${(i % fields) + 1}`, round: p.round, phase: "grupos" as const, bracket_slot: 1,
        group_name: p.group ?? null,
      }));
      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
      const local = pairs.filter((p) => p.home.state && p.home.state.trim().toLowerCase() === p.away.state?.trim().toLowerCase()).length;
      return { total: rows.length, local };
    },
    onSuccess: ({ total, local }) => {
      toast.success(`${total} partidos generados${local ? ` (${local} entre equipos del mismo estado, inevitable)` : ""}`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const seed = useMutation({
    mutationFn: async () => {
      if (!cat) throw new Error("Selecciona una categoría");
      if (catMatches.some((m) => m.phase === "semifinal" || m.phase === "final"))
        throw new Error("Ya existen partidos de playoffs en esta categoría.");
      const regular = catMatches.filter((m) => m.phase === "grupos" || m.phase === "cruce");
      if (regular.length === 0 || regular.some((m) => m.status !== "final"))
        throw new Error("Todos los partidos de fase regular deben estar en Final.");
      const rowsSt = computeStandings(catTeams, regular);
      const short = rowsSt.filter((r) => r.jj < 2);
      if (short.length) throw new Error(`Todos deben tener PJ = 2 antes de sembrar. Faltan: ${short.map((r) => `${r.team.name} (PJ ${r.jj})`).join(", ")}`);
      const table = rowsSt.map((r) => r.team);
      const last = regular.reduce((mx, m) => Math.max(mx, new Date(m.scheduled_at).getTime()), 0);
      const when = new Date((start ? new Date(start).getTime() : last + 86400000)).toISOString();
      const maxRound = Math.max(...regular.map((m) => m.round));
      const base = { category_id: cat.id, category: cat.gender, scheduled_at: when, round: maxRound + 1, phase: "semifinal" as const };
      const mk = (h: Team, a: Team, slot: number, bye?: Team) => ({ ...base, home_team_id: h.id, away_team_id: a.id, bracket_slot: slot, field: `Campo ${slot}`, bye_team_id: bye?.id ?? null });
      const rows = small
        ? [mk(table[1]!, table[2]!, 1, table[0]!)]
        : [mk(table[0]!, table[3]!, 1), mk(table[1]!, table[2]!, 2)];
      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Playoffs sembrados. La Final se llena sola al terminar las semifinales."); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const ranking = useMutation({
    mutationFn: async () => {
      if (!cat) throw new Error("Selecciona una categoría");
      if (n < 6 || n % 2) throw new Error("La Jornada de Ranqueo necesita un número par de equipos (mínimo 6)");
      if (catMatches.some((m) => m.phase === "cruce")) throw new Error("Ya existe la Jornada 3 en esta categoría.");
      const regular = catMatches.filter((m) => m.phase === "grupos");
      if (regular.length === 0) throw new Error("Primero juega las Jornadas 1 y 2.");
      const table = computeStandings(catTeams, regular).map((r) => r.team);
      const last = regular.reduce((mx, m) => Math.max(mx, new Date(m.scheduled_at).getTime()), 0);
      const t0 = start ? new Date(start).getTime() : last + interval * 60000;
      const rows = Array.from({ length: n / 2 }, (_, i) => ({
        category_id: cat.id, category: cat.gender, home_team_id: table[i]!.id, away_team_id: table[n - 1 - i]!.id,
        scheduled_at: new Date(t0 + Math.floor(i / fields) * interval * 60000).toISOString(),
        field: `Campo ${(i % fields) + 1}`, round: 3, phase: "cruce" as const, bracket_slot: i + 1, group_name: null, status: "programado" as const,
      }));
      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (c) => { toast.success(`Jornada 3 generada: ${c} partidos (1.º vs ${n}.º, 2.º vs ${n - 1}.º…)`); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div>
      <h2 className="mb-3 text-2xl text-primary">Asistente de formato</h2>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select className={field} value={effectiveCat} onChange={(e) => { setCatId(e.target.value); setMode(""); }}>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="flex items-center rounded-md bg-secondary px-3 font-display text-lg">{n} equipos</span>
        </div>

        {n < 3 ? (
          <p className="text-muted-foreground">Agrega al menos 3 equipos a esta categoría.</p>
        ) : small ? (
          <div className="rounded-md border border-border p-3">
            <p className="font-semibold">Round Robin (todos contra todos) · {n === 3 ? "3 partidos, 2 por equipo" : "6 partidos en 3 jornadas"}</p>
            <p className="text-muted-foreground">Playoffs: el 1.º va directo a la Gran Final; semifinal 2.º vs 3.º, el ganador enfrenta al 1.º.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(["ranking", "groups"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-md border-2 p-3 text-left ${effMode === m ? "border-primary" : "border-border"}`}>
                <p className="font-semibold">{m === "ranking" ? "Opción A · Fase de ranqueo" : "Opción B · Grupos por estado"}</p>
                <p className="text-muted-foreground">{m === "ranking" ? "Jornadas aleatorias contra rivales de otros estados." : "Divide en grupos separando equipos del mismo estado."}</p>
              </button>
            ))}
            {effMode === "ranking" ? (
              <select className={field} value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
                <option value={2}>2 jornadas</option><option value={3}>3 jornadas</option>
              </select>
            ) : (
              <select className={field} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
                {[2, 3, 4].filter((g) => n / g >= 2).map((g) => <option key={g} value={g}>{g} grupos</option>)}
              </select>
            )}
            <p className="self-center text-muted-foreground">Playoffs Top 4: 1.º vs 4.º y 2.º vs 3.º; los ganadores a la Gran Final.</p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1"><span className="text-muted-foreground">Inicio</span>
            <input type="datetime-local" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Minutos entre partidos</span>
            <input type="number" min={15} className={field} value={interval} onChange={(e) => setIntervalMin(Number(e.target.value) || 60)} /></label>
          <label className="space-y-1"><span className="text-muted-foreground">Campos disponibles</span>
            <input type="number" min={1} max={8} className={field} value={fields} onChange={(e) => setFields(Math.max(1, Number(e.target.value) || 1))} /></label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={n < 3 || generate.isPending} onClick={() => generate.mutate()}>Generar Partidos Automáticamente</Button>
          <Button variant="outline" disabled={n < 3 || seed.isPending} onClick={() => seed.mutate()}>Sembrar Playoffs Top-4</Button>
          <Button variant="secondary" disabled={n < 6 || ranking.isPending} onClick={() => ranking.mutate()}>Generar Jornada de Ranqueo (Jornada 3)</Button>
        </div>
        <p className="text-xs text-muted-foreground">Al sembrar se usa la fecha de “Inicio” (o el día siguiente al último partido). La Gran Final se crea sola cuando terminan las semifinales.</p>
      </div>
    </div>
  );
}
