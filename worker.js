// Serves the static site from dist/, sends every alias to the main domain, and maps share links (/k/<id>), /app and the
// OAuth consent page (/oauth/consent) to the app page. /mcp and /.well-known/oauth-protected-resource are the MCP server (mcp.js).
import { handleMcp, isMcpPath } from "./mcp.js";
import { systemState } from "./system/endpoint.mjs";
import { approvalApi } from "./system/approval-endpoint.mjs";
const CANONICAL = "kitchenstudio.design";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www. and the *.workers.dev address redirect to the main domain (keeps one URL in the wild)
    const systemPreview = url.hostname.endsWith('.workers.dev') && (url.pathname === '/system' || url.pathname.startsWith('/system/'));
    if (!systemPreview && url.hostname !== CANONICAL && (url.hostname === "www." + CANONICAL || url.hostname.endsWith(".workers.dev"))) {
      url.hostname = CANONICAL; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const p = url.pathname;
    if (p.startsWith('/system/private/')) return approvalApi(request, env);
    if (p === '/system/state.json') return systemState(request);
    if (p === '/system') return Response.redirect(new URL('/system/',url),302);
    if (p === '/system/control') return Response.redirect(new URL('/system/control/',url),302);
    if (isMcpPath(p)) return handleMcp(request, env);
    if (p.startsWith("/k/") || p === "/app" || p === "/app/" || p === "/oauth/consent" || p === "/oauth/consent/") {
      const r = await env.ASSETS.fetch(new Request(new URL("/app/", url), request));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
