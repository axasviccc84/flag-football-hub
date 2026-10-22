import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Current user's roles (empty when signed out). */
export function useMyRoles() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const q = useQuery({
    queryKey: ["roles-list", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });
  const roles = q.data ?? [];
  return { isAdmin: roles.includes("admin"), canScore: roles.includes("admin") || roles.includes("planillero") };
}
