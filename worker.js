// Serves the static site from dist/, sends every alias to the main domain, and maps share links (/k/<id>), /app and the
// OAuth consent page (/oauth/consent) to the app page. /mcp and /.well-known/oauth-protected-resource are the MCP server (mcp.js).
import { handleMcp, isMcpPath } from "./mcp.js";
const CANONICAL = "kitchenstudio.design";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Keep production aliases canonical while letting branch previews serve their own build.
    if (url.hostname === "www." + CANONICAL || url.hostname === "kitchen-studio.urosh-dxb.workers.dev") {
      url.hostname = CANONICAL; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const p = url.pathname;
    if (isMcpPath(p)) return handleMcp(request, env);
    if (p.startsWith("/k/") || p === "/app" || p === "/app/" || p === "/oauth/consent" || p === "/oauth/consent/") {
      const r = await env.ASSETS.fetch(new Request(new URL("/app/", url), request));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
