// Server API (TEST-PLAN.md section 3). Claude is replaced by a fake client, so nothing is billed.
// Run: node tests/api.test.js
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;
const handler = require(path.join(__dirname, '..', 'api', 'ask.js'));
const T = handler._test;

function call(method, body, headers, ip) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { resolve({ status: this.statusCode, body: JSON.parse(s), headers: this.headers }); } };
    handler({ method, body, headers: Object.assign({ host: 'halal-lens.vercel.app', 'x-forwarded-for': ip || '10.0.0.1' }, headers || {}), socket: {} }, res);
  });
}
// A stand-in for the Anthropic client: records the request and returns or throws what we tell it to.
function fake(reply) {
  const c = { last: null, beta: { messages: { create: async (req) => { c.last = req; if (reply instanceof Error) throw reply; return reply; } } } };
  T.setClient(c);
  return c;
}
const answer = (text, stop) => ({ stop_reason: stop || 'end_turn', content: [{ type: 'text', text }] });
const apiErr = (status) => Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: 'x' } }, 'x', new Headers());
const photo = { media_type: 'image/jpeg', data: Buffer.from('fake-jpeg').toString('base64') };

let fail = 0, total = 0;
function check(id, ok, msg) { total++; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + id + '  ' + msg); }

(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  let r = await call('GET');
  check('API-01', r.status === 200 && r.body.ai === false, 'GET says AI is off without a key');
  r = await call('POST', { task: 'product', args: { q: 'KitKat' } });
  check('API-02', r.status === 501 && r.body.code === 'server_off', 'POST without a key returns server_off');

  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  r = await call('GET');
  check('API-01', r.body.ai === true && r.headers['Cache-Control'] === 'no-store', 'GET says AI is on with a key, and is not cached');
  r = await call('POST', { task: 'product', args: { q: 'KitKat' } }, { origin: 'https://evil.example' });
  check('API-03', r.status === 403 && r.body.code === 'forbidden', 'other websites are refused');
  r = await call('POST', { task: 'write me a poem' });
  check('API-04', r.status === 400, 'unknown tasks are refused');
  r = await call('POST', { task: 'scan', image: { media_type: 'application/pdf', data: 'x' } });
  check('API-05', r.status === 400, 'non-image uploads are refused');
  r = await call('POST', { task: 'scan', image: { media_type: 'image/jpeg', data: 'a'.repeat(4 * 1024 * 1024 + 1) } });
  check('API-06', r.status === 400 && r.body.code === 'too_large', 'photos over 4 MB are refused');
  r = await call('POST', { task: 'product', args: { q: '' } });
  const r2 = await call('POST', { task: 'restaurant', args: { name: '' } });
  check('API-07', r.status === 400 && r2.status === 400, 'missing product or restaurant name is refused');
  r = await call('PUT', {});
  check('API-08', r.status === 405, 'PUT gets 405');
  check('API-09', T.readRequest({ task: 'product', args: { q: 'x'.repeat(500) } }).args.q.length === 200 &&
    T.readRequest({ task: 'restaurant', args: { name: 'y'.repeat(500), city: 'z'.repeat(500) } }).args.city.length === 120, 'inputs are trimmed');

  let c = fake(answer('{"known":true,"product":"KitKat"}'));
  r = await call('POST', JSON.stringify({ task: 'product', args: { q: 'KitKat', ctx: 'food' } }));
  check('API-10', r.status === 200 && r.body.result.product === 'KitKat', 'a JSON body sent as text is read');
  check('API-12', r.body.result.known === true, 'a good answer is returned as result');

  c = fake(answer('```json\n{"readable":true,"products":[]}\n```'));
  r = await call('POST', { task: 'scan', args: { ctx: 'cosmetic' }, image: photo });
  const req = c.last;
  check('API-11', req && req.model === (process.env.HL_MODEL || 'claude-opus-5-5') && req.output_config.effort === (process.env.HL_EFFORT || 'medium') &&
    req.fallbacks === 'default' && req.betas.includes('server-side-fallback-2026-07-01') &&
    req.messages[0].content[0].type === 'image' && req.messages[0].content[1].type === 'text' && /cosmetics/.test(req.messages[0].content[1].text),
    'request uses model, effort, refusal fallbacks, photo before instructions, and the cosmetics category');
  check('API-21', r.status === 200 && r.body.result.readable === true, 'fenced JSON answer is parsed');

  fake(answer('', 'refusal'));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-13', r.status === 422 && r.body.code === 'refused', 'a refusal returns refused');
  fake(answer('I am not sure about that product.'));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-14', r.status === 502 && r.body.code === 'invalid_json', 'a non-JSON answer returns invalid_json');
  fake(apiErr(401));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-15', r.status === 500 && r.body.code === 'server_off', 'a rejected key returns server_off');
  fake(apiErr(402));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-16', r.status === 402 && r.body.code === 'no_credit', 'out of credit returns no_credit');
  fake(apiErr(429));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-17', r.status === 429 && r.body.code === 'rate_limited', 'Claude rate limit returns rate_limited');
  fake(apiErr(400));
  r = await call('POST', { task: 'scan', args: {}, image: photo });
  check('API-18', r.status === 400 && r.body.code === 'image_rejected', 'a rejected image returns image_rejected');
  fake(apiErr(529));
  r = await call('POST', { task: 'product', args: { q: 'x' } });
  fake(new Error('socket hang up'));
  const r3 = await call('POST', { task: 'product', args: { q: 'x' } });
  check('API-19', r.status === 502 && r.body.code === 'upstream_error' && r3.status === 502 && r3.body.code === 'upstream_error', 'other errors and network failures return upstream_error');

  T.resetLimits();
  fake(answer('{"ok":true}'));
  const codes = [];
  for (let i = 0; i < 31; i++) codes.push((await call('POST', { task: 'product', args: { q: 'x' } }, null, '10.9.9.9')).status);
  const other = await call('POST', { task: 'product', args: { q: 'x' } }, null, '10.8.8.8');
  check('API-20', codes.slice(0, 30).every((s) => s === 200) && codes[30] === 429 && other.status === 200, 'the 31st request in 10 minutes from one visitor is refused; others are not affected');

  check('API-21', T.parseJSON('{"a":1}').a === 1 && T.parseJSON('Result: {"a":3} done').a === 3 && T.parseJSON('[1,2]')[1] === 2 && T.parseJSON('no json') === undefined, 'JSON parsing: bare, embedded, arrays, and plain text');

  console.log((total - fail) + '/' + total + ' API checks passed');
  process.exit(fail ? 1 : 0);
})();
