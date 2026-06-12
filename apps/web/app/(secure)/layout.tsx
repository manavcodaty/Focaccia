import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider } from "@/components/providers/auth-provider";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SecureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: organizer } = await supabase
    .from("organizer_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    redirect("/login?error=organizer_required");
  }

  return (
    <AuthProvider initialUser={user}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
