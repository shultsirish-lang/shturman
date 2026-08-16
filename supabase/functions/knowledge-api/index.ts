import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(req.url);
    const path = url.pathname.replace(/^.*\/knowledge-api/, "") || "/";
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 80), 1), 200);
    const selectColumns = "id,module,kind,title,quick,patient_answer,urgency,data,updated_at";
    const catalogColumns = "id,provider,code,title,specialty,topics,keywords,source_name,source_version,source_pages,updated_at";
    const searchStopWords = new Set([
      "анализ", "анализы", "сдать", "сдайте", "сдача", "на", "в", "во", "по", "для", "и", "или", "к", "о", "от", "из",
      "кровь", "крови", "моча", "мочи", "мазок", "мазка", "тест", "теста",
    ]);
    const normalizeSearch = (value: string) => {
      const meaningful = value.toLowerCase().match(/[\p{L}\p{N}+-]+/gu)?.filter((word) => !searchStopWords.has(word)) ?? [];
      return meaningful.join(" ") || value;
    };
    const toCard = (row: Record<string, unknown>) => ({ ...(row.data as object), ...row, data: undefined });
    const toCatalogResult = (row: Record<string, unknown>) => ({
      id: `catalog-${row.id}`,
      module: "Лабораторные анализы",
      kind: "Лабораторное исследование",
      title: row.title,
      quick: `${row.provider}: код ${row.code}${row.specialty ? ` · ${row.specialty}` : ""}`,
      patient_answer: "Уточните назначение врача и требования к подготовке для конкретного исследования.",
      urgency: "Обычная",
      code: row.code,
      keywords: [row.title, row.code, row.specialty, ...((row.topics as string[]) ?? []), ...((row.keywords as string[]) ?? [])].filter(Boolean),
      source: `${row.source_name}${row.source_version ? `, версия ${row.source_version}` : ""}`,
      source_pages: row.source_pages,
      updated_at: row.updated_at,
    });
    const fail = (error: { message?: string } | null) => json({ detail: error?.message ?? "Database error" }, 500);

    if (req.method === "GET" && path === "/health") {
      const { count, error } = await ctx.supabase.from("knowledge_cards").select("id", { count: "exact", head: true });
      if (error) return fail(error);
      const { count: catalogCount, error: catalogError } = await ctx.supabase.from("lab_catalog_items").select("id", { count: "exact", head: true });
      if (catalogError) return fail(catalogError);
      const { data: meta, error: metaError } = await ctx.supabase.from("knowledge_meta").select("value").eq("key", "data_version").maybeSingle();
      return metaError ? fail(metaError) : json({ status: "ok", records: count ?? 0, lab_catalog_records: catalogCount ?? 0, data_version: meta?.value ?? "" });
    }

    if (req.method === "GET" && path === "/modules") {
      const { data, error } = await ctx.supabase.from("knowledge_cards").select("module").order("module");
      if (error) return fail(error);
      const counts = new Map<string, number>();
      for (const row of data ?? []) counts.set(row.module, (counts.get(row.module) ?? 0) + 1);
      return json([...counts].map(([module, count]) => ({ module, count })));
    }

    if (req.method === "GET" && path === "/cards") {
      let query = ctx.supabase.from("knowledge_cards").select(selectColumns, { count: "exact" });
      for (const name of ["module", "kind", "urgency"] as const) {
        const value = url.searchParams.get(name);
        if (value) query = query.eq(name, value);
      }
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const { data, count, error } = await query.order("title").range(offset, offset + limit - 1);
      return error ? fail(error) : json({ total: count ?? 0, results: (data ?? []).map(toCard) });
    }

    const cardId = path.match(/^\/cards\/([^/]+)$/)?.[1];
    if (req.method === "GET" && cardId) {
      const { data, error } = await ctx.supabase.from("knowledge_cards").select(selectColumns).eq("id", decodeURIComponent(cardId)).maybeSingle();
      if (error) return fail(error);
      return data ? json(toCard(data)) : json({ detail: "Card not found" }, 404);
    }

    if (req.method === "GET" && path === "/search") {
      const term = url.searchParams.get("q")?.trim();
      if (!term) return json({ detail: "q is required" }, 422);
      const searchTerm = normalizeSearch(term);
      let query = ctx.supabase.from("knowledge_cards").select(selectColumns).textSearch("search_tsv", searchTerm, { config: "russian", type: "websearch" }).limit(limit);
      const module = url.searchParams.get("module");
      if (module) query = query.eq("module", module);
      const [{ data, error }, { data: catalog, error: catalogError }] = await Promise.all([
        query,
        ctx.supabase.from("lab_catalog_items").select(catalogColumns).textSearch("search_tsv", searchTerm, { config: "russian", type: "websearch" }).limit(limit),
      ]);
      if (error) return fail(error);
      if (catalogError) return fail(catalogError);
      const results = [...(data ?? []).map(toCard), ...(catalog ?? []).map(toCatalogResult)].slice(0, limit);
      return json({ query: term, normalized_query: searchTerm, total: results.length, results });
    }

    if (req.method === "GET" && path === "/lab-catalog") {
      let query = ctx.supabase.from("lab_catalog_items").select(catalogColumns, { count: "exact" });
      const topic = url.searchParams.get("topic");
      if (topic) query = query.contains("topics", [topic]);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
      const { data, count, error } = await query.order("title").range(offset, offset + limit - 1);
      return error ? fail(error) : json({ total: count ?? 0, results: (data ?? []).map(toCatalogResult) });
    }

    if (req.method === "POST" && path === "/admin/import") {
      if (ctx.authMode !== "secret") return json({ detail: "A secret API key is required" }, 403);
      const payload = await req.json();
      if (!Array.isArray(payload.cards) || payload.cards.length === 0) return json({ detail: "cards must be a non-empty array" }, 422);
      const rows = payload.cards.map((card: Record<string, unknown>) => {
        const { id, module = "", kind = "", title, quick = "", patient_answer = "", urgency = "", ...data } = card;
        return { id, module, kind, title, quick, patient_answer, urgency, data, updated_at: new Date().toISOString() };
      });
      const { error: upsertError } = await ctx.supabaseAdmin.from("knowledge_cards").upsert(rows, { onConflict: "id" });
      if (upsertError) return fail(upsertError);
      if (Array.isArray(payload.deleted_ids) && payload.deleted_ids.length) {
        const { error: deleteError } = await ctx.supabaseAdmin.from("knowledge_cards").delete().in("id", payload.deleted_ids);
        if (deleteError) return fail(deleteError);
      }
      const { error: metaError } = await ctx.supabaseAdmin.from("knowledge_meta").upsert({ key: "data_version", value: String(payload.data_version ?? "") }, { onConflict: "key" });
      return metaError ? fail(metaError) : json({ status: "ok", inserted_or_updated: rows.length, deleted: payload.deleted_ids?.length ?? 0, data_version: payload.data_version ?? "" });
    }

    if (req.method === "POST" && path === "/admin/lab-catalog/import") {
      if (ctx.authMode !== "secret") return json({ detail: "A secret API key is required" }, 403);
      const payload = await req.json();
      if (!Array.isArray(payload.items) || payload.items.length === 0) return json({ detail: "items must be a non-empty array" }, 422);
      const rows = payload.items.map((item: Record<string, unknown>) => ({
        id: item.id, provider: item.provider ?? "Helix", code: item.code, title: item.title,
        specialty: item.specialty ?? "", topics: item.topics ?? [], keywords: item.keywords ?? [], source_name: item.source_name ?? "",
        source_version: item.source_version ?? "", source_pages: item.source_pages ?? [], updated_at: new Date().toISOString(),
      }));
      if (rows.some((row: Record<string, unknown>) => !row.id || !row.code || !row.title)) return json({ detail: "Every item requires id, code, and title" }, 422);
      const { error } = await ctx.supabaseAdmin.from("lab_catalog_items").upsert(rows, { onConflict: "id" });
      return error ? fail(error) : json({ status: "ok", inserted_or_updated: rows.length });
    }

    return json({ detail: "Not found" }, 404);
  }),
};
