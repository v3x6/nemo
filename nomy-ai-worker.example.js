/**
 * Nomy AI — example Cloudflare Worker (server-side proxy)
 *
 * Deploy this worker, set secrets:
 *   OPENAI_API_KEY = sk-...
 * Then put the worker URL in Nomy Settings → Nomy AI connection.
 *
 * Expected request body:
 *   { message, language, context: { name, tasksTodayOpen, overdue, ... } }
 * Response:
 *   { reply: "..." }
 */
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }
    if (!env.OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY not configured" }, 500);
    }
    let body;
    try { body = await request.json(); } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const message = String(body.message || "").slice(0, 4000);
    if (!message) return json({ error: "Empty message" }, 400);

    const ctx = body.context || {};
    const lang = body.language === "ar" ? "Arabic" : "English";
    const system = `You are Nomy, a calm ocean-themed productivity coach for students.
Reply in ${lang}. Be concise and practical.
User context (authorized local data): ${JSON.stringify(ctx)}.
Do not invent metrics not in context. Do not claim medical diagnoses.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: message }
        ],
        temperature: 0.6,
        max_tokens: 600
      })
    });
    if (!r.ok) {
      const err = await r.text();
      return json({ error: "Upstream error", detail: err.slice(0, 200) }, 502);
    }
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || "No reply";
    return json({ reply }, 200);
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors() }
  });
}
