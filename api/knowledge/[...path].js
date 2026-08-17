const upstream = "https://osgkrmppcbusxweffrvs.supabase.co/functions/v1/knowledge-api";

export default async function handler(request, response) {
  // Vercel does not consistently expose a catch-all segment in request.query
  // for this route. Deriving it from the URL keeps /search, /cards etc. intact.
  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const routePrefix = "/api/knowledge/";
  const path = url.pathname.startsWith(routePrefix)
    ? decodeURIComponent(url.pathname.slice(routePrefix.length))
    : "";
  const query = url.searchParams;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || request.headers.apikey;

  try {
    const upstreamResponse = await fetch(`${upstream}/${path}${query.toString() ? `?${query}` : ""}`, {
      headers: key ? { apikey: key } : {},
      signal: AbortSignal.timeout(15000),
    });
    response.status(upstreamResponse.status);
    response.setHeader("Content-Type", upstreamResponse.headers.get("content-type") || "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.send(await upstreamResponse.text());
  } catch {
    response.status(503).json({ detail: "Knowledge API is temporarily unavailable" });
  }
}
