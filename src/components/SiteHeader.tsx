import { Link, useRouterState } from "@tanstack/react-router";
import { CATEGORIES, parseCategory } from "@/lib/tournament";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Posiciones" },
  { to: "/calendario", label: "Calendario" },
  { to: "/lideres", label: "Líderes" },
] as const;

export function SiteHeader() {
  const { pathname, search } = useRouterState({ select: (s) => s.location });
  const cat = parseCategory((search as Record<string, unknown>).cat);
  const isPublic = pathname === "/" || pathname === "/calendario" || pathname === "/lideres";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" search={{ cat }} className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-md" />
          <span className="font-display text-2xl leading-none">
            Flag<span className="text-primary">Torneo</span>
          </span>
        </Link>
        <Link
          to="/planilla"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          Planilleros
        </Link>
      </div>
      {isPublic && (
        <div className="mx-auto max-w-5xl px-4 pb-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {CATEGORIES.map((c) => (
              <Link
                key={c.value}
                to={pathname as "/"}
                search={{ cat: c.value }}
                className={cn(
                  "rounded-md py-2 text-center font-display text-lg transition-colors",
                  c.value === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>
          <nav className="mt-3 flex gap-6 border-b border-border">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                search={{ cat }}
                className={cn(
                  "-mb-px border-b-2 pb-2 text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname === n.to ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
