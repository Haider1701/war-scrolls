import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateChatCompletion } from "@lovable.dev/ai-gateway";

const AI_MODEL = "openai/gpt-6-astra";
const NPC_FIELDS = ["name", "race", "role", "personality", "quirk", "secret", "voice_tip", "plot_hook"] as const;
type Mode = "npc" | "recap";
function json(body: unknown, status: number) { return Response.json(body, { status }); }

export const Route = createFileRoute("/api/dm-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization") ?? "";
        if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in to use the DM writing tools." }, 401);
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return json({ error: "The DM writing tools are temporarily unavailable." }, 503);
        const client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            headers: { Authorization: authorization },
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) return json({ error: "Your sign-in expired. Sign in and try again." }, 401);
        const { data: preference } = await client.from("user_preferences").select("is_gm").eq("user_id", auth.user.id).maybeSingle();
        if (!preference?.is_gm) return json({ error: "Only DMs can use these writing tools." }, 403);

        let body: unknown;
        try { body = await request.json(); } catch { return json({ error: "The request was not valid. Please try again." }, 400); }
        if (!body || typeof body !== "object") return json({ error: "The request was not valid. Please try again." }, 400);
        const data = body as Record<string, unknown>;
        const mode = data.mode;
        const input = data.input;
        if (mode !== "npc" && mode !== "recap") return json({ error: "Choose NPC generation or session recap." }, 400);
        if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Enter the details to continue." }, 400);
        const fields = input as Record<string, unknown>;
        const campaignId = typeof fields.campaign_id === "string" ? fields.campaign_id : "";
        const maxLength = mode === "npc" ? 240 : 3000;
        const description = typeof fields.description === "string" ? fields.description.slice(0, maxLength).trim() : "";
        const tone = typeof fields.tone === "string" ? fields.tone.slice(0, 40) : "";
        const race = typeof fields.race === "string" ? fields.race.slice(0, 80) : "";
        const style = typeof fields.style === "string" ? fields.style.slice(0, 80) : "";
        if (!campaignId || !description || (mode === "recap" && !style)) return json({ error: "Fill in the required details before generating." }, 400);
        const { data: campaign } = await client.from("campaigns").select("id").eq("id", campaignId).eq("dm_user_id", auth.user.id).maybeSingle();
        if (!campaign) return json({ error: "Choose a campaign you manage to use these tools." }, 403);

        const { data: count, error: limitError } = await client.rpc("consume_dm_ai_usage");
        if (limitError || typeof count !== "number") {
          const { data: current } = await client.from("ai_usage").select("count").eq("user_id", auth.user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
          if (current?.count >= 20) return json({ error: "You have used all 20 DM generations for today. Try again tomorrow.", limit: 20, used: 20 }, 429);
          return json({ error: "Only DMs can use these writing tools." }, 403);
        }
        const system = mode === "npc"
          ? `Create a distinctive tabletop fantasy NPC. Return ONLY valid JSON with exactly these string fields: ${NPC_FIELDS.join(", ")}. Keep the output concise, around 500 tokens maximum. Do not include markdown fences.`
          : `You are a master tabletop campaign chronicler. Write an engaging session recap in the requested style, around 500 tokens maximum. Return plain text only.`;
        const prompt = mode === "npc"
          ? `Create an NPC for this description: ${description}. Tone: ${tone || "Friendly"}. Optional race: ${race || "choose a fitting race"}.`
          : `Turn these rough session notes into a recap. Style: ${style}. Notes:\n${description}`;
        try {
          const result = await generateChatCompletion({
            model: AI_MODEL,
            messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
            max_completion_tokens: 650,
            ...(mode === "npc" ? { response_format: { type: "json_object" as const } } : {}),
          });
          const text = result.choices[0]?.message.content;
          if (typeof text !== "string" || !text.trim()) return json({ error: "The result came back empty. Try generating again.", used: count, limit: 20 }, 502);
          if (mode === "recap") return json({ text: text.trim(), used: count, limit: 20 });
          let npc: unknown;
          try { npc = JSON.parse(text); } catch { return json({ error: "The result was not valid NPC data. Try again.", used: count, limit: 20 }, 502); }
          if (!npc || typeof npc !== "object" || NPC_FIELDS.some((field) => typeof (npc as Record<string, unknown>)[field] !== "string")) {
            return json({ error: "The result was missing some NPC details. Try again.", used: count, limit: 20 }, 502);
          }
          return json({ npc, used: count, limit: 20 });
        } catch {
          return json({ error: "Could not reach the writing forge. Your notes are saved here; please retry." , used: count, limit: 20 }, 502);
        }
      },
    },
  },
});