// Serves the static site from dist/ and maps share links (/k/<id>) and /app to the app page.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p.startsWith("/k/") || p === "/app" || p === "/app/") {
      const r = await env.ASSETS.fetch(new Request(new URL("/app/", url), request));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
