// MB Chatters AI — a SINGLE, clearly-labeled AI chat bot.
//
// Given the recent chat and a persona, it generates ONE short reply that adapts
// to what real viewers are saying. The LLM API key lives here on the server and
// is never sent to the browser. This is one labeled bot answering real people —
// not a fleet of accounts, and it never pretends to be a human viewer.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function systemPrompt(persona, botName, channel, maxChars) {
  return [
    `You are "${botName}", a single AI chat bot taking part in the live ${channel} chat.`,
    `You are a bot. Never claim to be a human viewer or pretend to be more than one person.`,
    persona ? `Your persona / what to talk about: ${persona}` : "",
    `Read the recent chat and reply naturally and specifically to what real viewers are saying — reference their messages, keep the conversation going.`,
    `Reply with ONE short message under ${maxChars} characters. No surrounding quotes, no @mentions spam, no links, no repeating yourself.`,
    `Keep it friendly and stream-appropriate. Never use slurs, harassment, hate, or NSFW content.`,
    `If nothing in the recent chat is worth replying to, respond with exactly: [skip]`,
  ]
    .filter(Boolean)
    .join("\n");
}

function finalize(text, maxChars) {
  const clean = String(text || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!clean) return { ok: false, error: "empty reply" };
  if (/^\[?\s*skip\s*\]?$/i.test(clean)) return { ok: true, reply: "", skip: true };
  return { ok: true, reply: clean.slice(0, Math.max(40, maxChars || 200)) };
}

async function callAnthropic({ apiKey, model, sys, user, maxChars }) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || "claude-opus-4-8",
      max_tokens: 256,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: d?.error?.message || `Anthropic HTTP ${r.status}` };
  const text = Array.isArray(d.content)
    ? d.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ")
    : "";
  return finalize(text, maxChars);
}

async function callOpenAI({ apiKey, model, sys, user, maxChars }) {
  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: d?.error?.message || `OpenAI HTTP ${r.status}` };
  return finalize(d.choices?.[0]?.message?.content || "", maxChars);
}

export async function generateReply({ provider, apiKey, model, persona, botName, channel, context, maxChars }) {
  const name = botName || "MB Chatters";
  const sys = systemPrompt(persona, name, channel || "the stream", maxChars || 200);
  const convo = context.map((m) => `${m.username}: ${m.text}`).join("\n");
  const user = `Recent chat:\n${convo}\n\nWrite one short reply as ${name} now, or [skip].`;
  try {
    return provider === "openai"
      ? await callOpenAI({ apiKey, model, sys, user, maxChars })
      : await callAnthropic({ apiKey, model, sys, user, maxChars });
  } catch (e) {
    return { ok: false, error: e?.message || "LLM request failed" };
  }
}
