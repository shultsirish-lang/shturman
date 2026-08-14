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
    const toCard = (row: Record<string, unknown>) => ({ ...(row.data as object), ...row, data: undefined });
    const fail = (error: { message?: string } | null) => json({ detail: error?.message ?? "Database error" }, 500);

    if (req.method === "GET" && path === "/health") {
      const { count, error } = await ctx.supabase.from("knowledge_cards").select("id", { count: "exact", head: true });
      if (error) return fail(error);
      const { data: meta, error: metaError } = await ctx.supabase.from("knowledge_meta").select("value").eq("key", "data_version").maybeSingle();
      return metaError ? fail(metaError) : json({ status: "ok", records: count ?? 0, data_version: meta?.value ?? "" });
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
      let query = ctx.supabase.from("knowledge_cards").select(selectColumns).textSearch("search_tsv", term, { config: "russian", type: "websearch" }).limit(limit);
      const module = url.searchParams.get("module");
      if (module) query = query.eq("module", module);
      const { data, error } = await query;
      return error ? fail(error) : json({ query: term, total: data?.length ?? 0, results: (data ?? []).map(toCard) });
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

    return json({ detail: "Not found" }, 404);
  }),
};
