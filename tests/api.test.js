// Tests for api/ask.js that never call Claude. Run: node tests/api.test.js
const path = require('path');
const handler = require(path.join(__dirname, '..', 'api', 'ask.js'));
const { parseJSON, readRequest } = handler._test;

function call(method, body, headers) {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(s) { resolve({ status: this.statusCode, body: JSON.parse(s) }); } };
    handler({ method, body, headers: Object.assign({ host: 'halal-lens.vercel.app' }, headers || {}), socket: {} }, res);
  });
}

let fail = 0;
function check(name, ok) { if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name); }

(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  let r = await call('GET');
  check('GET reports AI off without a key', r.status === 200 && r.body.ai === false);
  r = await call('POST', { task: 'product', args: { q: 'KitKat' } });
  check('POST without a key returns 501 server_off', r.status === 501 && r.body.code === 'server_off');

  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  r = await call('GET');
  check('GET reports AI on with a key', r.body.ai === true);
  r = await call('POST', { task: 'product', args: { q: 'KitKat' } }, { origin: 'https://evil.example' });
  check('Other websites are refused', r.status === 403);
  r = await call('POST', { task: 'write me a poem' });
  check('Unknown tasks are refused', r.status === 400);
  r = await call('POST', { task: 'scan', image: { media_type: 'application/pdf', data: 'x' } });
  check('Non-image uploads are refused', r.status === 400);

  check('readRequest trims inputs', readRequest({ task: 'product', args: { q: 'x'.repeat(500) } }).args.q.length === 200);
  check('parseJSON reads bare JSON', parseJSON('{"a":1}').a === 1);
  check('parseJSON reads fenced JSON', parseJSON('Here:\n```json\n{"a":2}\n```').a === 2);
  check('parseJSON reads JSON inside a sentence', parseJSON('Result: {"a":3} done').a === 3);
  check('parseJSON gives undefined for text', parseJSON('no json here') === undefined);

  console.log(fail ? '\n' + fail + ' failed' : '\nall API tests passed');
  process.exit(fail ? 1 : 0);
})();
