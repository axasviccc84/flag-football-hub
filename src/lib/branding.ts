import { useEffect } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  id: boolean;
  tournament_name: string;
  primary_color: string;
  updated_at: string;
};

export const DEFAULT_NAME = "FlagTorneo";
export const DEFAULT_COLOR = "#f97316";

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Loads tournament branding and applies the accent color to the theme tokens. */
export function useBranding() {
  const q = useQuery(settingsQuery());
  const name = q.data?.tournament_name ?? DEFAULT_NAME;
  const color = q.data?.primary_color ?? DEFAULT_COLOR;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", color);
    root.style.setProperty("--ring", color);
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    };
  }, [color]);

  return { name, color, isLoading: q.isLoading };
}
