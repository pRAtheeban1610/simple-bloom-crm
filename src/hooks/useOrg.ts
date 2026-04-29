import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrg(enabled: boolean) {
  return useQuery({
    queryKey: ["org"],
    enabled,
    queryFn: async () => {
      const { data: profile, error: pe } = await supabase
        .from("profiles").select("organization_id, full_name, email").maybeSingle();
      if (pe) throw pe;
      if (!profile) return null;
      const { data: org, error: oe } = await supabase
        .from("organizations").select("*").eq("id", profile.organization_id).maybeSingle();
      if (oe) throw oe;
      return { profile, org };
    },
  });
}
