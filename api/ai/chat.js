function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanAiMessage(value) {
  return String(value || "").trim().slice(0, 1200);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function normalizeAiMessages(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: cleanAiMessage(message?.content)
    }))
    .filter((message) => message.content)
    .slice(-12);
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use POST for Vel AI chat."
    });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return sendJson(res, 503, {
      error: "missing_config",
      message: "Set OPENAI_API_KEY in Vercel Environment Variables, then redeploy."
    });
  }

  try {
    const body = await readJsonBody(req);
    const messages = normalizeAiMessages(body.messages);
    if (!messages.length) {
      return sendJson(res, 400, {
        error: "missing_message",
        message: "Send at least one message."
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: "You are Vel AI inside vel.os. Be helpful, concise, friendly, and practical. Keep answers clear for a student building a web OS. Do not claim you can bypass school or network restrictions.",
        input: messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        max_output_tokens: 900,
        store: false
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: data.error?.code || "openai_error",
        message: data.error?.message || "Vel AI could not reach OpenAI."
      });
    }

    return sendJson(res, 200, {
      reply: extractOpenAiText(data) || "Vel AI did not return text.",
      model: data.model || process.env.OPENAI_MODEL || "gpt-5-mini"
    });
  } catch (error) {
    return sendJson(res, 400, {
      error: "bad_request",
      message: error.message || "Vel AI could not read the request."
    });
  }
};
