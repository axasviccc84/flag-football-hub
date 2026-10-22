import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eventsByMatchQuery, type Match, type MatchStatus, type Team } from "@/lib/tournament";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function BracketEditDialog({ match, teams, label, isAdmin, onClose }: {
  match: Match | null; teams: Team[]; label: string; isAdmin: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const events = useQuery({ ...eventsByMatchQuery(match?.id ?? ""), enabled: !!match });
  const hasEvents = (events.data?.length ?? 0) > 0;
  const [home, setHome] = useState(""); const [away, setAway] = useState("");
  const [hs, setHs] = useState(0); const [as, setAs] = useState(0);
  const [status, setStatus] = useState<MatchStatus>("programado");
  useEffect(() => {
    if (!match) return;
    setHome(match.home_team_id); setAway(match.away_team_id);
    setHs(match.home_score); setAs(match.away_score); setStatus(match.status);
  }, [match]);

  const save = useMutation({
    mutationFn: async () => {
      if (!match) return;
      if (home === away) throw new Error("Selecciona dos equipos distintos");
      if (status === "final" && match.phase === "semifinal" && hs === as && !hasEvents) throw new Error("Una semifinal no puede terminar empatada");
      const patch: Partial<Match> = { status };
      if (isAdmin) { patch.home_team_id = home; patch.away_team_id = away; }
      // Manual score only when no plays were captured; otherwise the score comes from the plays.
      if (!hasEvents) { patch.home_score = hs; patch.away_score = as; }
      const { error } = await supabase.from("matches").update(patch).eq("id", match.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(status === "final" && match?.phase === "semifinal" ? "Marcador guardado. El ganador avanza a la Final." : "Partido actualizado");
      qc.invalidateQueries({ queryKey: ["matches"] }); onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  return (
    <Dialog open={!!match} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl">{label}</DialogTitle></DialogHeader>
        {match && (
          <form className="space-y-4 text-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {[{ id: home, set: setHome, s: hs, setS: setHs, l: "Local" }, { id: away, set: setAway, s: as, setS: setAs, l: "Visitante" }].map((r) => (
              <div key={r.l} className="grid grid-cols-[1fr_6rem] items-end gap-2">
                <label className="space-y-1"><span className="text-muted-foreground">{r.l}</span>
                  {isAdmin ? (
                    <select className={field} value={r.id} onChange={(e) => r.set(e.target.value)}>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : <div className={field}>{name(r.id)}</div>}
                </label>
                <input type="number" min={0} disabled={hasEvents} className={`${field} text-center font-display text-2xl`} value={r.s} onChange={(e) => r.setS(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            ))}
            {hasEvents && (
              <p className="text-muted-foreground">Este partido tiene jugadas capturadas; el marcador se calcula de ellas. <Link to="/planilla/$matchId" params={{ matchId: match.id }} className="text-primary underline">Abrir planilla</Link></p>
            )}
            <label className="block space-y-1"><span className="text-muted-foreground">Estado</span>
              <select className={field} value={status} onChange={(e) => setStatus(e.target.value as MatchStatus)}>
                <option value="programado">Programado</option><option value="en_vivo">En vivo</option><option value="final">Finalizado</option>
              </select>
            </label>
            {isAdmin && <p className="text-xs text-muted-foreground">Como administrador puedes cambiar los equipos para un ajuste extraordinario de sembrado.</p>}
            <Button type="submit" className="w-full" disabled={save.isPending}>Guardar</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
