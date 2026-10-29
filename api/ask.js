// Vercel serverless function: POST /api/ask sends one fixed task (scan, product, restaurant) to an AI.
// Providers, picked by which key is set in Vercel's environment variables:
//   ANTHROPIC_API_KEY -> Claude (paid, most accurate)
//   GEMINI_API_KEY    -> Google Gemini free tier (no card needed; Google may use free-tier data to improve its products)
// HL_PROVIDER=claude|gemini forces one when both are set. GET /api/ask reports whether AI is on, and which.
// The browser never chooses the prompt: it only picks a task and sends its few inputs.
const sdk = require('@anthropic-ai/sdk');
const Anthropic = sdk.default || sdk;
const PROMPTS = require('../prompts.js');

const MODEL = process.env.HL_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.HL_EFFORT || 'medium';
const LIMIT = Number(process.env.HL_RATE_LIMIT || 30);     // requests per visitor per 10 minutes
const WINDOW = 10 * 60 * 1000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_B64 = 4 * 1024 * 1024;                      // Vercel caps request bodies at 4.5 MB
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const hits = new Map();
let client;
let doFetch = (...a) => fetch(...a);

function provider() {
  const forced = process.env.HL_PROVIDER;
  if (forced === 'claude' && process.env.ANTHROPIC_API_KEY) return 'claude';
  if (forced === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}
// Free-tier allowances are per model, so a second model doubles the free capacity.
function geminiModels() {
  const list = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash-lite'].filter(Boolean);
  return list.filter((m, i) => list.indexOf(m) === i);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function fail(status, code, error) { const e = new Error(error); e.status = status; e.code = code; return e; }

// Best effort: counts live per server instance, which is enough to stop casual abuse.
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

function short(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }

function readRequest(body) {
  if (!body || typeof body !== 'object') return { error: 'Send a JSON body.' };
  const task = body.task;
  const a = body.args || {};
  const ctx = a.ctx === 'cosmetic' ? 'cosmetic' : 'food';
  let args;
  if (task === 'scan') args = { ctx };
  else if (task === 'product') args = { q: short(a.q, 200), ctx };
  else if (task === 'restaurant') args = { name: short(a.name, 120), city: short(a.city, 120) };
  else return { error: 'Unknown task.' };
  if (task === 'product' && !args.q) return { error: 'Missing product name.' };
  if (task === 'restaurant' && !args.name) return { error: 'Missing restaurant name.' };

  let image = null;
  if (task === 'scan') {
    const img = body.image || {};
    if (!IMAGE_TYPES.includes(img.media_type) || typeof img.data !== 'string' || !img.data) return { error: 'Send a JPG, PNG, WebP or GIF photo.' };
    if (img.data.length > MAX_IMAGE_B64) return { error: 'The photo is too large.', code: 'too_large' };
    image = { media_type: img.media_type, data: img.data };
  }
  return { task, args, image };
}

// Accept a bare JSON reply, a fenced one, or JSON with a sentence around it.
function parseJSON(text) {
  const tries = [text, (text.match(/```(?:json)?\s*([\s\S]*?)```/) || [])[1]];
  const first = text.search(/[[{]/), last = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (first >= 0 && last > first) tries.push(text.slice(first, last + 1));
  for (const t of tries) {
    if (!t) continue;
    try { return JSON.parse(t); } catch (e) { /* try the next form */ }
  }
  return undefined;
}

async function askClaude(prompt, image) {
  const content = image ? [{ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } }] : [];
  content.push({ type: 'text', text: prompt });
  client = client || new Anthropic();
  let msg;
  try {
    msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: EFFORT },
      // If a safety classifier declines, the API retries on a suitable model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw fail(500, 'server_off', 'The server\'s API key was rejected.');
    if (err instanceof Anthropic.APIError && err.status === 402) throw fail(402, 'no_credit', 'The site\'s AI credit has run out.');
    if (err instanceof Anthropic.RateLimitError) throw fail(429, 'rate_limited', 'The AI service is busy. Try again shortly.');
    if (err instanceof Anthropic.BadRequestError) throw fail(400, image ? 'image_rejected' : 'bad_request', err.message);
    if (err instanceof Anthropic.APIError) throw fail(502, 'upstream_error', 'Claude API error ' + err.status + '.');
    throw fail(502, 'upstream_error', 'Could not reach Claude.');
  }
  if (msg.stop_reason === 'refusal') throw fail(422, 'refused', 'Claude declined this request.');
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function askGemini(prompt, image) {
  const parts = image ? [{ inline_data: { mime_type: image.media_type, data: image.data } }] : [];
  parts.push({ text: prompt });
  const body = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json' } });
  let last = 0;
  for (const model of geminiModels()) {
    let res, data = {};
    try {
      res = await doFetch(GEMINI_URL + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body
      });
      data = await res.json().catch(() => ({}));
    } catch (e) { throw fail(502, 'upstream_error', 'Could not reach Gemini.'); }
    if (res.ok) {
      const cand = (data.candidates || [])[0] || {};
      if ((data.promptFeedback && data.promptFeedback.blockReason) || /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(cand.finishReason || '')) {
        throw fail(422, 'refused', 'Gemini declined this request.');
      }
      return ((cand.content || {}).parts || []).map((p) => p.text || '').join('');
    }
    last = res.status;
    // 404: model not offered to this key; 429: this model's free allowance is used up. Try the next model.
    if (res.status === 404 || res.status === 429) continue;
    const reasons = JSON.stringify((data.error && data.error.details) || []);
    if (res.status === 401 || res.status === 403 || /API_KEY_INVALID/.test(reasons)) throw fail(500, 'server_off', 'The server\'s Gemini key was rejected.');
    if (res.status === 400) throw fail(400, image ? 'image_rejected' : 'bad_request', (data.error && data.error.message) || 'Bad request.');
    throw fail(502, 'upstream_error', 'Gemini error ' + res.status + '.');
  }
  if (last === 429) throw fail(429, 'rate_limited', 'Today\'s free AI allowance is used up. Try again later.');
  throw fail(502, 'upstream_error', 'No Gemini model is available for this key.');
}

async function handler(req, res) {
  const who = provider();
  if (req.method === 'GET') return send(res, 200, { ai: !!who, provider: who });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.', code: 'bad_request' });
  if (!who) return send(res, 501, { error: 'AI is not switched on for this site.', code: 'server_off' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'Requests must come from this site.', code: 'forbidden' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many requests. Wait a few minutes.', code: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const r = readRequest(body);
  if (r.error) return send(res, 400, { error: r.error, code: r.code || 'bad_request' });

  try {
    const prompt = PROMPTS[r.task](r.args);
    const text = who === 'gemini' ? await askGemini(prompt, r.image) : await askClaude(prompt, r.image);
    const result = parseJSON(text);
    if (result === undefined) return send(res, 502, { error: 'The answer came back in an unexpected shape.', code: 'invalid_json' });
    return send(res, 200, { result, provider: who });
  } catch (err) {
    return send(res, err.status || 502, { error: err.message || 'Could not reach the AI.', code: err.code || 'upstream_error' });
  }
}

module.exports = handler;
module.exports._test = {
  parseJSON, readRequest, provider, geminiModels,
  setClient: (c) => { client = c; },
  setFetch: (f) => { doFetch = f; },
  resetLimits: () => hits.clear()
};
