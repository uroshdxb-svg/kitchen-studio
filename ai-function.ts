// Compatibility endpoint only. AI is supplied by user-connected MCP agents.
// Keep JWT verification enabled on deployment.
import { retiredAI } from './ai-handler.mjs';
Deno.serve(retiredAI);
