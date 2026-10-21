/**
 * ANI AI — Cloudflare Worker API
 *
 * Deploy this file as a Cloudflare Worker, then add a secret named
 * CEREBRAS_API_KEY in Worker Settings > Variables and Secrets.
 * Never put the API key in GitHub files or browser JavaScript.
 */

const ALLOWED_ORIGINS = [
  "https://anirudhadebbarma031214-commits.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST to send a chat message." }, 405, origin);
    }

    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: "This website origin is not allowed." }, 403, origin);
    }

    if (!env.CEREBRAS_API_KEY) {
      return json({ error: "The AI API key is not configured on the server yet." }, 500, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "The request body must be valid JSON." }, 400, origin);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: "Send at least one chat message." }, 400, origin);
    }

    const messages = body.messages.slice(-20).map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: String(message.content || "").slice(0, 12000)
    })).filter((message) => message.content.trim().length > 0);

    if (!messages.length) {
      return json({ error: "Your message is empty." }, 400, origin);
    }

    try {
      const upstream = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CEREBRAS_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: "You are ANI AI, a helpful, friendly assistant. Help with learning, writing, and programming. For coding tasks, provide clear explanations and complete code when appropriate. Never claim you executed or tested code unless you actually did. If a user shares an error, diagnose it step by step."
            },
            ...messages
          ],
          temperature: 0.7,
          max_completion_tokens: 1600
        })
      });

      const result = await upstream.json();

      if (!upstream.ok) {
        const message = result?.error?.message || "The AI provider rejected the request.";
        return json({ error: message }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, origin);
      }

      const reply = result?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        return json({ error: "The AI provider returned an empty response. Please try again." }, 502, origin);
      }

      return json({ reply }, 200, origin);
    } catch {
      return json({ error: "Could not reach the AI service. Please try again shortly." }, 502, origin);
    }
  }
};
