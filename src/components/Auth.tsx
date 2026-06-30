import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Embers } from "./Embers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    let ok = true;
    if (!EMAIL_RE.test(email.trim())) {
      setEmailErr("Enter a valid email address."); ok = false;
    } else setEmailErr("");
    if (password.length < 6) {
      setPwErr("Password must be at least 6 characters."); ok = false;
    } else setPwErr("");
    return ok;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation required — try direct sign in (in case auto-confirm just hasn't propagated)
          const { error: sErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          if (sErr) {
            setInfo("Account created. Check your email to confirm your account, then sign in.");
            setMode("in");
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      if (e?.status === 429 || /rate/i.test(msg)) {
        setErr("Too many attempts, please wait a moment.");
      } else if (/invalid login credentials/i.test(msg)) {
        setErr("Email or password is incorrect.");
      } else if (/already registered|already.*exist/i.test(msg)) {
        setErr("An account with that email already exists. Try signing in.");
      } else {
        setErr(msg);
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative">
      <Embers />
      <form onSubmit={submit} noValidate className="j-page p-10 w-full max-w-md relative">
        <div className="j-spine" />
        <div className="pl-6">
          <h1 className="j-h text-4xl text-center mb-1">Ember Codex</h1>
          <p className="text-center text-[var(--color-muted)] italic mb-6">
            A journal forged in divine flame
          </p>
          <div className="j-divider-ornate">✦ ✦ ✦</div>

          <label className="block mb-3">
            <span className="text-sm text-[var(--color-muted)] block mb-1">Email</span>
            <input className="j-input" type="email" required value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
              maxLength={255} />
            {emailErr && <div className="text-[var(--color-blood)] text-xs mt-1">{emailErr}</div>}
          </label>
          <label className="block mb-2">
            <span className="text-sm text-[var(--color-muted)] block mb-1">Password</span>
            <input className="j-input" type="password" required minLength={6} maxLength={72} value={password}
              onChange={(e) => { setPassword(e.target.value); if (pwErr) setPwErr(""); }} />
            <div className="text-[10px] text-[var(--color-muted)] mt-1 italic">At least 6 characters.</div>
            {pwErr && <div className="text-[var(--color-blood)] text-xs mt-1">{pwErr}</div>}
          </label>

          {err && <div className="j-affliction my-4 text-sm">{err}</div>}
          {info && <div className="j-card my-4 text-sm italic text-[var(--color-flame)]">{info}</div>}

          <button className="j-btn w-full mb-3 mt-4" disabled={loading} type="submit">
            {loading ? "Working…" : mode === "in" ? "Sign In" : "Create Account"}
          </button>
          <button type="button" className="j-btn-ghost j-btn w-full"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); setInfo(""); }}>
            {mode === "in" ? "No account yet? Create one" : "Already have an account? Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
