// Kitchen Studio AI proxy (Supabase Edge Function, Deno).
// The browser never sees the Anthropic key. Signed-in users only, with a daily limit per user.
// Secrets to set:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (AI_MODEL and AI_DAILY_LIMIT are optional)
import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("AI_MODEL") ?? "claude-sonnet-4-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "40");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (_) { /* fall through */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* fall through */ } }
  throw new Error("The model did not return JSON");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  if (!ANTHROPIC_API_KEY) return reply(500, { error: "AI is not configured on the server", code: "failed" });

  // Who is asking? (the gateway already checked the JWT; this resolves the user id)
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: uerr } = await userClient.auth.getUser();
  if (uerr || !user) return reply(401, { error: "Sign in first", code: "not_granted" });

  let body: { prompt?: string; tier?: string; kind?: string };
  try { body = await req.json(); } catch (_) { return reply(400, { error: "Bad request" }); }
  const prompt = String(body.prompt ?? "");
  if (prompt.length < 10 || prompt.length > 120_000) return reply(400, { error: "Prompt too short or too long" });

  // Daily limit
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("owner", user.id).gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) return reply(429, { error: "Daily AI limit reached. Try again tomorrow.", code: "rate_limited" });

  // Ask the model
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: "You answer for a commercial kitchen design app. Reply with only the JSON the user asks for: no prose, no code fences.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (res.status === 429 || res.status === 529) return reply(429, { error: "The AI is busy. Try again in a minute.", code: "rate_limited" });
  if (!res.ok) return reply(502, { error: `AI request failed (${res.status})`, code: "failed" });
  const out = await res.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");

  await admin.from("ai_usage").insert({
    owner: user.id, kind: body.kind ?? (prompt.includes("EQUIPMENT CATALOGUE") ? "brief" : "lookup"),
    tokens_in: out.usage?.input_tokens ?? null, tokens_out: out.usage?.output_tokens ?? null,
  });

  try { return reply(200, { json: extractJson(text) }); }
  catch (e) { return reply(502, { error: (e as Error).message, code: "failed" }); }
});
