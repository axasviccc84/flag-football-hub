import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { allTeamsQuery, categoriesQuery, GENDERS, useLiveTournament, type CategoryRow, type Gender, type Team } from "@/lib/tournament";
import { useScorerRole } from "@/lib/use-scorer";
import { Button } from "@/components/ui/button";

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
  const [filter, setFilter] = useState("");
  const reset = () => { setEditing(null); setName(""); setShort(""); };
  const effectiveCat = catId || cats.data?.[0]?.id || "";

  const save = useMutation({
    mutationFn: async () => {
      const cat = cats.data?.find((c) => c.id === effectiveCat);
      if (!name.trim()) throw new Error("Escribe el nombre del equipo");
      if (!/^[A-Z0-9]{3}$/.test(short)) throw new Error("La abreviatura debe tener 3 letras");
      if (!cat) throw new Error("Selecciona una categoría");
      const row = { name: name.trim(), short_name: short, category_id: cat.id, category: cat.gender };
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
      <form className="mb-4 grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_6rem_12rem_auto_auto]" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <input className={field} placeholder="Nombre del equipo" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${field} uppercase`} placeholder="ABC" maxLength={3} value={short} onChange={(e) => setShort(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
        <select className={field} value={effectiveCat} onChange={(e) => setCatId(e.target.value)}>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <span className="font-semibold">{t.name}</span>
              <span className="text-muted-foreground">· {catName(t.category_id)}</span>
            </span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(t); setName(t.name); setShort(t.short_name); setCatId(t.category_id ?? ""); }}>Editar</Button>
              <Button size="sm" variant="destructive" onClick={() => confirm(`¿Eliminar ${t.name}?`) && remove.mutate(t.id)}>Eliminar</Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
