// Kitchen Studio authenticated AI proxy. Keep verify_jwt enabled on deployment.
import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { createAIHandler } from "./ai-handler.mjs";

Deno.serve(createAIHandler({
  createClient,
  config: {
    url: Deno.env.get("SUPABASE_URL") ?? "",
    anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
    model: Deno.env.get("AI_MODEL") || "claude-sonnet-4-5",
    dailyLimit: Number(Deno.env.get("AI_DAILY_LIMIT")) || 40,
  },
}));
