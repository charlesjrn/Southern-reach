import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

type Contact = { id: string; email: string | null; phone: string | null };

// Email and phone are only returned for the signed-in user, or for everyone when the caller is Admin/HR/Management.
async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.rpc("get_profile_contacts");
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const [{ data: profile }, { data: roleRows }, contacts] = await Promise.all([
        supabase.from("profiles").select("id, employee_id, full_name, department_id, position_id, manager_id, is_active, created_at, updated_at, department:departments(name), position:positions(title)").eq("id", auth.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", auth.user.id),
        fetchContacts(),
      ]);
      const mine = contacts.find((c) => c.id === auth.user.id);
      return {
        user: auth.user,
        profile: profile ? { ...profile, email: mine?.email ?? auth.user.email ?? "", phone: mine?.phone ?? null } : null,
        roles: (roleRows ?? []).map((r) => r.role as AppRole),
      };
    },
  });
}

export function useStaffList() {
  return useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const [{ data, error }, contacts] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, employee_id, is_active, department_id, position_id, department:departments(name), position:positions(title)")
          .order("full_name"),
        fetchContacts(),
      ]);
      if (error) throw error;
      const byId = new Map(contacts.map((c) => [c.id, c]));
      return (data ?? []).map((p) => ({ ...p, email: byId.get(p.id)?.email ?? null }));
    },
  });
}
