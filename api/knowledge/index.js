const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, content-type",
};

export default function handler(request, response) {
  Object.entries(corsHeaders).forEach(([name, value]) => response.setHeader(name, value));
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "GET") return response.status(405).json({ detail: "Read-only API: GET requests only" });

  return response.status(200).json({
    status: "ok",
    name: "Green Clinic Intelligence API",
    version: "1",
    authentication: "Send the Green Clinic Supabase Publishable Key in the apikey header for data endpoints.",
    endpoints: {
      health: "/api/knowledge/health",
      modules: "/api/knowledge/modules",
      search: "/api/knowledge/search?q=%D0%B3%D0%B5%D1%80%D0%BF%D0%B5%D1%81",
      card: "/api/knowledge/cards/LAB-METHODS-001",
      cards: "/api/knowledge/cards?module=%D0%9B%D0%B0%D0%B1%D0%BE%D1%80%D0%B0%D1%82%D0%BE%D1%80%D0%BD%D1%8B%D0%B5%20%D0%B0%D0%BD%D0%B0%D0%BB%D0%B8%D0%B7%D1%8B",
      labCatalog: "/api/knowledge/lab-catalog?limit=80",
    },
    documentation: "https://github.com/shultsirish-lang/shturman/blob/main/docs/clientix-api.md",
  });
}
