import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrg(enabled: boolean) {
  return useQuery({
    queryKey: ["org"],
    enabled,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: profile, error: pe } = await supabase
        .from("profiles")
        .select("organization_id, full_name, email, organization:organizations(*)")
        .maybeSingle();
      if (pe) throw pe;
      if (!profile) return null;
      const { organization, ...rest } = profile as any;
      return { profile: rest, org: organization };
    },
  });
}
