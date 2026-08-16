const upstream = "https://osgkrmppcbusxweffrvs.supabase.co/functions/v1/knowledge-api";

export default async function handler(request, response) {
  const path = Array.isArray(request.query.path) ? request.query.path.join("/") : (request.query.path || "");
  const query = new URLSearchParams(request.query);
  query.delete("path");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
