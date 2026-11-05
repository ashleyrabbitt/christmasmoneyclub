import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN } from './site-config.mjs';

const cwd = fileURLToPath(new URL('.', import.meta.url));
const child = spawn(process.execPath, ['server.mjs'], {
  cwd, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
const ready = new Promise((resolve, reject) => {
  let output = '';
  const timer = setTimeout(() => reject(new Error('Server did not start. ' + stderr)), 10000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}. ${stderr}`)); });
  child.stdout.on('data', chunk => {
    output += chunk;
    const line = output.split('\n').find(line => line.startsWith('{'));
    if (!line || !output.includes('\n')) return;
    try {
      const event = JSON.parse(line);
      if (event.event === 'listening') { clearTimeout(timer); resolve(event); }
    } catch { /* Wait for the rest of a partial output chunk. */ }
  });
});

let requests = 0;
try {
  const listening = await ready;
  assert.equal(listening.address, '0.0.0.0');
  assert.equal(listening.canonicalOrigin, SITE_ORIGIN);
  const request = (url, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
    requests++;
    const req = http.request({ hostname: '127.0.0.1', port: listening.port, path: url, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ status: response.statusCode, headers: response.headers, body, text: body.toString('utf8') });
      });
      response.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('HTTP request timed out.')));
    req.end();
  });

  const sitemap = await request('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers['content-type'], /^application\/xml/);
  const locations = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.ok(locations.length >= 17);
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(locations.every(url => url.startsWith(SITE_ORIGIN + '/')));
  assert.ok(!locations.some(url => url.endsWith('/404.html')));

  for (const location of locations) {
    const pathname = new URL(location).pathname;
    const page = await request(pathname);
    assert.equal(page.status, 200, pathname);
    assert.match(page.headers['content-type'], /^text\/html/);
    assert.ok(page.text.includes(`<link rel="canonical" href="${location}">`), pathname);
    assert.ok(!page.text.includes('ashleyrabbittcodes.chatgpt.site'), pathname);
    assert.equal(Number(page.headers['content-length']), page.body.length);
  }

  const home = await request('/');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.equal(home.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(home.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
  const head = await request('/', { method: 'HEAD' });
  assert.equal(head.status, home.status);
  assert.equal(head.headers['content-type'], home.headers['content-type']);
  assert.equal(head.headers['content-length'], home.headers['content-length']);
  assert.equal(head.body.length, 0);
  const unchanged = await request('/', { headers: { 'If-None-Match': home.headers.etag } });
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body.length, 0);

  const assets = {
    'style.css': 'text/css', 'app.js': 'text/javascript', 'planner-math.js': 'text/javascript',
    'favicon.svg': 'image/svg+xml', 'christmas-planning.png': 'image/png'
  };
  for (const [filename, type] of Object.entries(assets)) {
    const asset = await request('/assets/' + filename);
    assert.equal(asset.status, 200, filename);
    assert.ok(asset.headers['content-type'].startsWith(type), filename);
    assert.deepEqual(asset.body, readFileSync(new URL('./dist/assets/' + filename, import.meta.url)));
    if (filename !== 'favicon.svg') {
      assert.deepEqual(asset.body, readFileSync(new URL('./public/assets/' + filename, import.meta.url)));
    }
  }
  const robots = await request('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(robots.headers['content-type'], /^text\/plain/);
  assert.ok(robots.text.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`));

  for (const url of ['/missing-page/', '/404.html', '/404.html/', '/%2f404.html', '/server.mjs', '/content/articles.json', '/.git/config', '/_headers', '/_headers/', '/%2f_headers', '/%2e%2e/package.json', '/..%2f..%2fpackage.json']) {
    const missing = await request(url);
    assert.equal(missing.status, 404, url);
    assert.ok(missing.text.includes('Page not found'), url);
    assert.equal(missing.headers['x-robots-tag'], 'noindex');
  }
  const missingHead = await request('/missing-page/', { method: 'HEAD' });
  assert.equal(missingHead.status, 404);
  assert.equal(missingHead.body.length, 0);
  assert.ok(Number(missingHead.headers['content-length']) > 0);
  for (const url of ['/%zz', '/assets/x%00.png', '//external.example/']) {
    assert.equal((await request(url)).status, 400, url);
  }
  const post = await request('/', { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');

  const canonicalHost = new URL(SITE_ORIGIN).hostname;
  const www = await request('/planner/?from=test', { headers: { Host: `www.${canonicalHost}`, 'X-Forwarded-Proto': 'https' } });
  assert.equal(www.status, 308);
  assert.equal(www.headers.location, SITE_ORIGIN + '/planner/?from=test');
  const insecure = await request('/guides/', { headers: { Host: canonicalHost, 'X-Forwarded-Proto': 'http' } });
  assert.equal(insecure.status, 308);
  assert.equal(insecure.headers.location, SITE_ORIGIN + '/guides/');
  for (const headers of [
    { Host: canonicalHost, 'X-Forwarded-Proto': 'https' },
    { Host: canonicalHost },
    { Host: 'christmas-money-club-production.up.railway.app', 'X-Forwarded-Proto': 'http' }
  ]) {
    assert.equal((await request('/', { headers })).status, 200);
  }
  const slash = await request('/save?from=test');
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.location, '/save/?from=test');
  for (const pathname of ['/guides/index.html', '/guides/%69ndex.html', '/guides%2findex.html']) {
    const index = await request(pathname + '?from=test');
    assert.equal(index.status, 308);
    assert.equal(index.headers.location, '/guides/?from=test');
  }
  const rootIndex = await request('/index.html');
  assert.equal(rootIndex.status, 308);
  assert.equal(rootIndex.headers.location, '/');

  const health = await request('/healthz', { headers: { Host: 'healthcheck.railway.app' } });
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.text), { status: 'ok' });
  assert.equal(health.headers['cache-control'], 'no-store');
  const healthHead = await request('/healthz', { method: 'HEAD', headers: { Host: `www.${canonicalHost}` } });
  assert.equal(healthHead.status, 200);
  assert.equal(healthHead.body.length, 0);
  assert.equal(stderr, '');
  console.log(JSON.stringify({ status: 'passed', htmlRoutes: locations.length, assetRoutes: Object.keys(assets).length, httpRequests: requests }));
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const [code] = await exited;
    assert.equal(code, 0, 'Server should shut down cleanly on SIGTERM.');
  }
}
