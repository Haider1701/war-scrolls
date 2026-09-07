import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Character } from "@/lib/types";
import { AuthScreen } from "@/components/Auth";
import { CreateWizard } from "@/components/CreateWizard";
import { Journal } from "@/components/Journal";
import { NpcPage } from "@/components/NpcPage";
import { CharacterSelect } from "@/components/CharacterSelect";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DiceRollerProvider } from "@/components/DiceRoller";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ember Codex — D&D Character Journal" },
      { name: "description", content: "A handcrafted dark-fantasy journal for your D&D character — track stats, spells, sessions, NPCs and gear." },
      { property: "og:title", content: "Ember Codex — D&D Character Journal" },
      { property: "og:description", content: "A dark-fantasy D&D journal for characters, campaigns, maps, combat, spells, and sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const db = supabase as any;
const LS_KEY = "ember-codex.active-character";

function Index() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload(preferActive?: string | null) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setUserId(null); setCharacters([]); setActiveId(null);
      setReady(true);
      return;
    }
    setUserId(u.user.id);
    const { data: chars } = await db.from("characters").select("*").eq("user_id", u.user.id).order("created_at", { ascending: true });
    const list: Character[] = chars ?? [];
    setCharacters(list);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    const preferred = preferActive ?? stored;
    const found = list.find((c) => c.id === preferred);
    setActiveId(found ? found.id : null);
    setCreating(false);
    setReady(true);
  }

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(LS_KEY);
          Object.keys(window.localStorage)
            .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
            .forEach((k) => window.localStorage.removeItem(k));
        }
        setUserId(null);
        setCharacters([]);
        setActiveId(null);
        setCreating(false);
        setReady(true);
        return;
      }
      if (event === "SIGNED_IN" && session?.user) {
        reload();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
  }

  function selectActive(id: string | null) {
    setActiveId(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(LS_KEY, id);
      else window.localStorage.removeItem(LS_KEY);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-muted)] italic gap-3">
        <span className="j-spinner" /> Kindling the codex…
      </div>
    );
  }

  const active = characters.find((c) => c.id === activeId) ?? null;

  async function saveCharacterTheme(patch: { theme?: any; custom_theme?: any }) {
    if (!active) return;
    await db.from("characters").update(patch).eq("id", active.id);
    setCharacters((cs) => cs.map((c) => (c.id === active.id ? { ...c, ...patch } : c)));
  }

  return (
    <ThemeProvider character={active} onSaveCharacterTheme={saveCharacterTheme}>
      <ToastProvider>
        <DiceRollerProvider>
          {!userId ? (
            <AuthScreen />
          ) : creating || characters.length === 0 ? (
            <CreateWizard
              userId={userId}
              onDone={async (newId?: string) => {
                await reload(newId ?? null);
                if (newId) selectActive(newId);
              }}
              onCancel={characters.length > 0 ? () => setCreating(false) : undefined}
            />
          ) : !active ? (
            <CharacterSelect
              characters={characters}
              onPlay={(id) => selectActive(id)}
              onCreate={() => setCreating(true)}
              onDeleted={() => reload(null)}
              onSignOut={signOut}
            />
          ) : active.character_type === "npc" ? (
            <NpcPage
              key={active.id}
              initial={active}
              characters={characters}
              onSwitch={(id) => selectActive(id)}
              onBackToSelect={() => selectActive(null)}
              onCreateNew={() => setCreating(true)}
              onSignOut={signOut}
            />
          ) : (
            <Journal
              key={active.id}
              initial={active}
              userId={userId}
              characters={characters}
              onSwitch={(id) => selectActive(id)}
              onBackToSelect={() => selectActive(null)}
              onCreateNew={() => setCreating(true)}
              onSignOut={signOut}
            />
          )}
        </DiceRollerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
