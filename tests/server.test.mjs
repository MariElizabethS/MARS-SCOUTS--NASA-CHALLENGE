import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createStaticServer} from '../server.mjs';

test('the English page, stylesheet and entire module graph load over HTTP', async t => {
  const server = createStaticServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html; charset=utf-8/);
  const html = await response.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /Start walk/);
  assert.doesNotMatch(html,/About Mars weather|class="weather-source"/);
  const stylePath = html.match(/<link rel="stylesheet" href="([^"]+)"/)[1];
  const style = await fetch(new URL(stylePath, base));
  assert.equal(style.status, 200);
  assert.match(style.headers.get('content-type'), /text\/css/);
  const pending = [html.match(/<script type="module" src="([^"]+)"/)[1]], seen = new Set();
  while (pending.length) {
    const url = new URL(pending.pop(), base).href;
    if (seen.has(url)) continue;
    seen.add(url);
    const moduleResponse = await fetch(url);
    assert.equal(moduleResponse.status, 200, url);
    assert.match(moduleResponse.headers.get('content-type'), /text\/javascript/, url);
    const source = await moduleResponse.text();
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) pending.push(new URL(match[1], url).href);
  }
  assert.ok(seen.size >= 9);
  for(const photo of ['wildcat','skinner','jezero','gale']){
    const image=await fetch(base+'/assets/places/'+photo+'.jpg');
    assert.equal(image.status,200);
    assert.match(image.headers.get('content-type'),/image\/jpeg/);
    const bytes=new Uint8Array(await image.arrayBuffer());
    assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length>10000);
  }
  assert.equal((await fetch(base + '/.git/config')).status, 403);
  const missing = await fetch(base + '/missing.js');
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'File not found');
});

test('startup explains a busy port instead of reporting an unhandled error', async t => {
  const server = createStaticServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {...process.env, PORT: String(server.address().port)}, stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', data => { stderr += data; });
  const [code] = await once(child, 'close');
  assert.equal(code, 1);
  assert.match(stderr, /already in use/);
  assert.match(stderr, /http:\/\/localhost:/);
  assert.doesNotMatch(stderr, /Unhandled|node:events/);
});
