import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventsByMatchQuery, type Gender, type Match, type MatchPhase, type Team } from "@/lib/tournament";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export type BracketTarget = {
  label: string; phase: Extract<MatchPhase, "semifinal" | "final">; slot: number;
  match?: Match | undefined; home?: string | undefined; away?: string | undefined;
};

export function BracketEditDialog({ target, teams, isAdmin, categoryId, gender, onClose }: {
  target: BracketTarget | null; teams: Team[]; isAdmin: boolean; categoryId: string; gender: Gender | undefined; onClose: () => void;
}) {
  const qc = useQueryClient();
  const match = target?.match;
  const events = useQuery({ ...eventsByMatchQuery(match?.id ?? ""), enabled: !!match });
  const hasEvents = (events.data?.length ?? 0) > 0;
  const [home, setHome] = useState(""); const [away, setAway] = useState("");
  const [hs, setHs] = useState(0); const [as, setAs] = useState(0);
  useEffect(() => {
    if (!target) return;
    setHome(match?.home_team_id ?? target.home ?? ""); setAway(match?.away_team_id ?? target.away ?? "");
    setHs(match?.home_score ?? 0); setAs(match?.away_score ?? 0);
  }, [target, match]);

  const save = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (!home || !away || home === away) throw new Error("Selecciona dos equipos distintos");
      if (!hasEvents && hs === as) throw new Error("Un partido de playoffs no puede terminar empatado");
      if (match) {
        const patch: Partial<Match> = { status: "final" };
        if (isAdmin) { patch.home_team_id = home; patch.away_team_id = away; }
        if (!hasEvents) { patch.home_score = hs; patch.away_score = as; }
        const { error } = await supabase.from("matches").update(patch).eq("id", match.id);
        if (error) throw error;
      } else {
        if (!gender) throw new Error("Categoría no encontrada");
        const { error } = await supabase.from("matches").insert({
          category_id: categoryId, category: gender, phase: target.phase, bracket_slot: target.slot,
          home_team_id: home, away_team_id: away, home_score: hs, away_score: as,
          status: "final", scheduled_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const w = teams.find((t) => t.id === (hs > as ? home : away))?.name;
      toast.success(target?.phase === "final" ? `🏆 ¡${w ?? "El ganador"} es Campeón del Torneo!` : "Marcador guardado. El ganador avanza a la Final.");
      qc.invalidateQueries({ queryKey: ["matches"] }); onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "Por definir";
  const canPickTeams = isAdmin || !match;
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">{target?.label}</DialogTitle></DialogHeader>
        {target && (
          <form className="space-y-4 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {[{ id: home, set: setHome, s: hs, setS: setHs, l: "Equipo 1" }, { id: away, set: setAway, s: as, setS: setAs, l: "Equipo 2" }].map((r) => (
              <div key={r.l} className="grid grid-cols-[1fr_6rem] items-end gap-2">
                <label className="space-y-1"><span className="text-muted-foreground">{r.l}</span>
                  {canPickTeams ? (
                    <select className={field} value={r.id} onChange={(e) => r.set(e.target.value)}>
                      <option value="">Por definir</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : <div className={field}>{name(r.id)}</div>}
                </label>
                <input type="number" min={0} aria-label={`Puntos ${r.l}`} disabled={hasEvents} className={`${field} text-center font-display text-2xl`} value={r.s} onChange={(e) => r.setS(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            ))}
            {hasEvents && match && (
              <p className="text-muted-foreground">Este partido tiene jugadas capturadas; el marcador se calcula de ellas. <Link to="/planilla/$matchId" params={{ matchId: match.id }} className="text-primary underline">Abrir planilla</Link></p>
            )}
            <p className="text-xs text-muted-foreground">Al guardar, el partido queda como Finalizado.</p>
            <Button type="submit" className="w-full" disabled={save.isPending}>Guardar marcador</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
