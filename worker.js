// Serves the static site from dist/, sends every alias to the main domain, and maps share links (/k/<id>) and /app to the app page.
const CANONICAL = "kitchenstudio.design";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www. and the *.workers.dev address redirect to the main domain (keeps one URL in the wild)
    if (url.hostname !== CANONICAL && (url.hostname === "www." + CANONICAL || url.hostname.endsWith(".workers.dev"))) {
      url.hostname = CANONICAL; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const p = url.pathname;
    if (p.startsWith("/k/") || p === "/app" || p === "/app/") {
      const r = await env.ASSETS.fetch(new Request(new URL("/app/", url), request));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
