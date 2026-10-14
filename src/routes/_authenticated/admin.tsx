import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { allTeamsQuery, categoriesQuery, matchesQuery, GENDERS, GROUPS, PHASE_LABELS, STATUS_LABELS, formatDate, type MatchPhase, useLiveTournament, type CategoryRow, type Gender, type Team } from "@/lib/tournament";
import { useScorerRole } from "@/lib/use-scorer";
import { Button } from "@/components/ui/button";
import { FormatWizard } from "@/components/FormatWizard";
import { stateTag } from "@/lib/generator";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración · Torneo Flag Football" },
      { name: "description", content: "Gestiona categorías y equipos del torneo." },
      { property: "og:title", content: "Administración del Torneo" },
      { property: "og:description", content: "Alta, edición y baja de categorías y equipos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const errMsg = (e: unknown) => {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? "Error");
  return m.includes("foreign key") ? "No se puede eliminar: tiene equipos o partidos asociados." : m;
};

function AdminPage() {
  const { user } = Route.useRouteContext();
  useLiveTournament();
  const scorer = useScorerRole(user.id);
  if (scorer.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!scorer.data)
    return <div className="rounded-xl border border-destructive bg-card p-4 text-sm">Tu cuenta no tiene permiso de administrador o planillero.</div>;
  return (
    <section className="space-y-10">
      <h1 className="text-4xl">Administración</h1>
      <CategoriesAdmin />
      <TeamsAdmin />
      <FormatWizard />
      <MatchesAdmin />
    </section>
  );
}

function CategoriesAdmin() {
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery());
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("varonil");
  const reset = () => { setEditing(null); setName(""); setGender("varonil"); };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Escribe el nombre de la categoría");
      const { error } = editing
        ? await supabase.from("categories").update({ name: name.trim(), gender }).eq("id", editing.id)
        : await supabase.from("categories").insert({ name: name.trim(), gender, sort_order: (cats.data?.length ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoría guardada"); reset(); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["teams"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoría eliminada"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <h2 className="mb-3 text-2xl text-primary">Categorías</h2>
      <form className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_10rem_auto_auto]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <input className={field} placeholder="Ej. U18 Varonil" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={field} value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <Button type="submit" disabled={save.isPending}>{editing ? "Guardar" : "Agregar"}</Button>
        {editing && <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>}
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(cats.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span><span className="font-semibold">{c.name}</span> <span className="text-muted-foreground">· {GENDERS.find((g) => g.value === c.gender)?.label}</span></span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(c); setName(c.name); setGender(c.gender); }}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm(`¿Eliminar ${c.name}?`) && remove.mutate(c.id)}>Eliminar</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamsAdmin() {
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery());
  const teams = useQuery(allTeamsQuery());
  const [editing, setEditing] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [short, setShort] = useState("");
  const [catId, setCatId] = useState("");
  const [group, setGroup] = useState("");
  const [origin, setOrigin] = useState("");
  const [filter, setFilter] = useState("");
  const reset = () => { setEditing(null); setName(""); setShort(""); setGroup(""); setOrigin(""); };
  const effectiveCat = catId || cats.data?.[0]?.id || "";

  const save = useMutation({
    mutationFn: async () => {
      const cat = cats.data?.find((c) => c.id === effectiveCat);
      if (!name.trim()) throw new Error("Escribe el nombre del equipo");
      if (!/^[A-Z0-9]{3}$/.test(short)) throw new Error("La abreviatura debe tener 3 letras");
      if (!cat) throw new Error("Selecciona una categoría");
      const row = { name: name.trim(), short_name: short, category_id: cat.id, category: cat.gender, group_name: group || null, state: origin.trim() || null };
      const { error } = editing
        ? await supabase.from("teams").update(row).eq("id", editing.id)
        : await supabase.from("teams").insert(row);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Equipo guardado"); reset(); qc.invalidateQueries({ queryKey: ["teams"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Equipo eliminado"); qc.invalidateQueries({ queryKey: ["teams"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = (teams.data ?? []).filter((t) => !filter || t.category_id === filter);
  const catName = (id: string | null) => cats.data?.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <h2 className="mb-3 text-2xl text-primary">Equipos</h2>
      <form className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_6rem_9rem_12rem_8rem_auto_auto]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <input className={field} placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${field} uppercase`} placeholder="ABC" maxLength={3} value={short} onChange={(e) => setShort(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
        <input className={field} placeholder="Estado (QRO)" value={origin} onChange={(e) => setOrigin(e.target.value)} />
        <select className={field} value={effectiveCat} onChange={(e) => setCatId(e.target.value)}>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={field} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Sin grupo</option>
          {GROUPS.map((g) => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
        <Button type="submit" disabled={save.isPending}>{editing ? "Guardar" : "Agregar"}</Button>
        {editing && <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>}
      </form>
      <select className={`${field} mb-3 max-w-xs`} value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">Todas las categorías</option>
        {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">Sin equipos.</li>}
        {list.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="rounded bg-secondary px-1.5 py-0.5 font-display">{t.short_name}</span>
              <span className="font-semibold">{t.name}</span>{t.state && <span className="rounded border border-accent px-1 text-xs text-accent">{stateTag(t)}</span>}
              <span className="text-muted-foreground">· {catName(t.category_id)}{t.group_name ? ` · Grupo ${t.group_name}` : ""}</span>
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(t); setName(t.name); setShort(t.short_name); setCatId(t.category_id ?? ""); setGroup(t.group_name ?? ""); setOrigin(t.state ?? ""); }}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm(`¿Eliminar ${t.name}?`) && remove.mutate(t.id)}>Eliminar</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PHASES: MatchPhase[] = ["grupos", "cruce", "semifinal", "final"];

function MatchesAdmin() {
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery());
  const teams = useQuery(allTeamsQuery());
  const matches = useQuery(matchesQuery());
  const [catId, setCatId] = useState("");
  const [group, setGroup] = useState("");
  const [phase, setPhase] = useState<MatchPhase>("grupos");
  const [round, setRound] = useState(1);
  const [slot, setSlot] = useState(1);
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [when, setWhen] = useState("");
  const [fieldName, setFieldName] = useState("Campo 1");
  const effectiveCat = catId || cats.data?.[0]?.id || "";
  const catTeams = (teams.data ?? []).filter((t) => t.category_id === effectiveCat && (!group || phase !== "grupos" || t.group_name === group));
  const teamName = (id: string) => { const t = teams.data?.find((x) => x.id === id); return t ? `${t.name}${t.state ? ` (${stateTag(t)})` : ""}` : "—"; };

  const onPhase = (p: MatchPhase) => { setPhase(p); setRound(p === "grupos" ? 1 : p === "cruce" ? 3 : p === "semifinal" ? 4 : 5); };

  const save = useMutation({
    mutationFn: async () => {
      const cat = cats.data?.find((c) => c.id === effectiveCat);
      if (!cat) throw new Error("Selecciona una categoría");
      if (!home || !away || home === away) throw new Error("Selecciona dos equipos distintos");
      if (!when) throw new Error("Indica fecha y hora");
      const { error } = await supabase.from("matches").insert({
        category_id: cat.id, category: cat.gender, home_team_id: home, away_team_id: away,
        scheduled_at: new Date(when).toISOString(), field: fieldName || "Campo 1",
        round, phase, bracket_slot: slot, group_name: phase === "grupos" && group ? group : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Partido programado"); setHome(""); setAway(""); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Partido eliminado"); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = (matches.data ?? []).filter((m) => m.category_id === effectiveCat);

  return (
    <div>
      <h2 className="mb-3 text-2xl text-primary">Partidos</h2>
      <form className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <select className={field} value={effectiveCat} onChange={(e) => { setCatId(e.target.value); setHome(""); setAway(""); }}>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={field} value={phase} onChange={(e) => onPhase(e.target.value as MatchPhase)}>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
        </select>
        {phase === "grupos" ? (
          <select className={field} value={round} onChange={(e) => setRound(Number(e.target.value))}>
            <option value={1}>Jornada 1</option><option value={2}>Jornada 2</option>
          </select>
        ) : phase === "semifinal" ? (
          <select className={field} value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
            <option value={1}>Semifinal 1</option><option value={2}>Semifinal 2</option>
          </select>
        ) : <div className="flex items-center px-1 text-sm text-muted-foreground">Jornada {round}</div>}
        <select className={field} value={group} disabled={phase !== "grupos"} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Sin grupo</option>
          {GROUPS.map((g) => <option key={g} value={g}>Grupo {g}</option>)}
        </select>
        <select className={field} value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Local…</option>
          {catTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className={field} value={away} onChange={(e) => setAway(e.target.value)}>
          <option value="">Visitante…</option>
          {catTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="datetime-local" className={field} value={when} onChange={(e) => setWhen(e.target.value)} />
        <input className={field} placeholder="Campo" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
        <Button type="submit" className="sm:col-span-4" disabled={save.isPending}>Programar partido</Button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {list.length === 0 && <li className="p-4 text-sm text-muted-foreground">Sin partidos en esta categoría.</li>}
        {list.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{teamName(m.home_team_id)} vs {teamName(m.away_team_id)}</span>
              <span className="block text-xs text-muted-foreground">
                {PHASE_LABELS[m.phase]}{m.phase === "grupos" ? ` · J${m.round}` : ""}{m.group_name ? ` · Grupo ${m.group_name}` : ""} · {formatDate(m.scheduled_at)} · {m.field} · {STATUS_LABELS[m.status]}
              </span>
            </span>
            <Button size="sm" variant="destructive" onClick={() => confirm("¿Eliminar partido?") && remove.mutate(m.id)}>Eliminar</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
