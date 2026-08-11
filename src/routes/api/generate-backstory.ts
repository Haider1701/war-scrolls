import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const FREE_LIMIT = 5;

const SYSTEM_PROMPT =
  "You are a master D&D storyteller. Write a cinematic, immersive character backstory for a tabletop RPG character. " +
  "The backstory should be 3-4 paragraphs, richly detailed, emotionally engaging, and feel unique to this character. " +
  "Do not use clichés. Match the tone and style specified. " +
  "End with an unresolved tension or mystery that could drive campaign story hooks.";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/generate-backstory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.toLowerCase().startsWith("bearer ")) {
          return json({ error: "You must be signed in to generate a backstory." }, 401);
        }

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["SUPABASE_PUBLISHABLE_KEY"]!,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: auth } },
          },
        );

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData?.user;
        if (userErr || !user) {
          return json({ error: "Your session expired. Sign in again to continue." }, 401);
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("ai_backstory_count")
          .eq("user_id", user.id)
          .maybeSingle();

        const used = (profile as { ai_backstory_count?: number } | null)?.ai_backstory_count ?? 0;
        if (used >= FREE_LIMIT) {
          return json(
            {
              error:
                "You've used all free generations. Upgrade to Adventurer plan for unlimited generations.",
              limitReached: true,
              used,
              limit: FREE_LIMIT,
            },
            402,
          );
        }

        let body: Record<string, string> = {};
        try {
          body = (await request.json()) as Record<string, string>;
        } catch {
          return json({ error: "Malformed request." }, 400);
        }

        const race = (body.race || "mysterious wanderer").slice(0, 120);
        const klass = (body.class || "adventurer").slice(0, 160);
        const alignment = (body.alignment || "unaligned").slice(0, 60);
        const tone = (body.tone || "mysterious and complex").slice(0, 60);
        const style = (body.style || "narrative prose").slice(0, 60);
        const extra = (body.extra || "").slice(0, 200);

        const userPrompt =
          `Write a ${tone} backstory in ${style} for a ${race} ${klass} with ${alignment} alignment.` +
          (extra ? ` Additional details: ${extra}` : "");

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return json({ error: "AI generation is temporarily unavailable." }, 503);
        }

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "google/gemini-3-pro-preview",
              stream: true,
              max_tokens: 600,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt },
              ],
            }),
          });
        } catch {
          return json({ error: "Could not reach the AI service. Try again." }, 502);
        }

        if (!upstream.ok || !upstream.body) {
          if (upstream.status === 429) {
            return json({ error: "The forge is busy — too many requests. Try again shortly." }, 429);
          }
          if (upstream.status === 402) {
            return json({ error: "AI credits are exhausted. Add credits to continue." }, 402);
          }
          if (upstream.status === 401 || upstream.status === 403) {
            return json({ error: "AI generation is temporarily unavailable." }, 503);
          }
          return json({ error: "The AI service returned an error. Please retry." }, 502);
        }

        // Count this as a successful generation.
        await supabase
          .from("user_profiles")
          .update({ ai_backstory_count: used + 1 })
          .eq("user_id", user.id);

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const reader = upstream.body!.getReader();
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const raw of lines) {
                  const line = raw.trim();
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(payload);
                    const delta = parsed?.choices?.[0]?.delta?.content;
                    if (typeof delta === "string" && delta) {
                      controller.enqueue(encoder.encode(delta));
                    }
                  } catch {
                    /* ignore malformed keep-alive chunks */
                  }
                }
              }
            } catch {
              /* end stream on read failure */
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-cache",
            "x-generations-used": String(used + 1),
            "x-generations-limit": String(FREE_LIMIT),
          },
        });
      },
    },
  },
});
