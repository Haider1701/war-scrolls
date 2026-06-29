import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { AuthScreen } from "@/components/Auth";
import { CreateWizard } from "@/components/CreateWizard";
import { Journal } from "@/components/Journal";
import { ToastProvider } from "@/components/Toast";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ember Codex — D&D Character Journal" },
      { name: "description", content: "A handcrafted dark-fantasy journal for your D&D character — track stats, spells, sessions, NPCs and gear." },
    ],
  }),
  component: Index,
});

const db = supabase as any;

function Index() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [character, setCharacter] = useState<Character | null>(null);

  async function reload() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setUserId(null); setCharacter(null); setLoading(false); return; }
    setUserId(u.user.id);
    const { data: chars } = await db.from("characters").select("*").eq("user_id", u.user.id).order("created_at", { ascending: true }).limit(1);
    setCharacter(chars?.[0] ?? null);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") reload();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-muted)] italic">
        Kindling the codex…
      </div>
    );
  }

  return (
    <ToastProvider>
      {!userId ? (
        <AuthScreen />
      ) : !character ? (
        <CreateWizard userId={userId} onDone={reload} />
      ) : (
        <Journal initial={character} onSignOut={async () => { await supabase.auth.signOut(); }} />
      )}
    </ToastProvider>
  );
}
