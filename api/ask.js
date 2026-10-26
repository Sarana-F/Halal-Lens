// Vercel serverless function: POST /api/ask sends one fixed task (scan, product, restaurant) to Claude.
// Needs the environment variable ANTHROPIC_API_KEY. GET /api/ask reports whether AI is switched on.
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
const hits = new Map();
let client;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

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
    image = { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } };
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

async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { ai: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.', code: 'bad_request' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 501, { error: 'AI is not switched on for this site.', code: 'server_off' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'Requests must come from this site.', code: 'forbidden' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many requests. Wait a few minutes.', code: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const r = readRequest(body);
  if (r.error) return send(res, 400, { error: r.error, code: r.code || 'bad_request' });

  const content = r.image ? [r.image] : [];
  content.push({ type: 'text', text: PROMPTS[r.task](r.args) });
  client = client || new Anthropic();
  try {
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: EFFORT },
      // If a safety classifier declines, the API retries on a suitable model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    });
    if (msg.stop_reason === 'refusal') return send(res, 422, { error: 'Claude declined this request.', code: 'refused' });
    const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const result = parseJSON(text);
    if (result === undefined) return send(res, 502, { error: 'The answer came back in an unexpected shape.', code: 'invalid_json' });
    return send(res, 200, { result });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The server\'s API key was rejected.', code: 'server_off' });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'The AI service is busy. Try again shortly.', code: 'rate_limited' });
    if (err instanceof Anthropic.BadRequestError) return send(res, 400, { error: err.message, code: r.image ? 'image_rejected' : 'bad_request' });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: 'Claude API error ' + err.status + '.', code: 'upstream_error' });
    return send(res, 502, { error: 'Could not reach Claude.', code: 'upstream_error' });
  }
}

module.exports = handler;
module.exports._test = { parseJSON, readRequest };
