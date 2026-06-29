import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Embers } from "./Embers";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
    } catch (e: any) { setErr(e.message ?? "Something went wrong"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <Embers />
      <form onSubmit={submit} className="j-page p-10 w-full max-w-md relative">
        <div className="j-spine" />
        <div className="pl-6">
          <h1 className="j-h text-4xl text-center mb-1">Ember Codex</h1>
          <p className="text-center text-[var(--color-muted)] italic mb-6">
            A journal forged in divine flame
          </p>
          <div className="j-divider-ornate">✦ ✦ ✦</div>

          <label className="block mb-3">
            <span className="text-sm text-[var(--color-muted)] block mb-1">Email</span>
            <input className="j-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </label>
          <label className="block mb-4">
            <span className="text-sm text-[var(--color-muted)] block mb-1">Password</span>
            <input className="j-input" type="password" required minLength={6} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {err && <div className="j-affliction mb-4 text-sm">{err}</div>}

          <button className="j-btn w-full mb-3" disabled={loading}>
            {loading ? "..." : mode === "in" ? "Enter the Codex" : "Forge New Codex"}
          </button>
          <button type="button" className="j-btn-ghost j-btn w-full" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No codex yet? Create one" : "Already keep one? Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
