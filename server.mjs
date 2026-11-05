import { createServer } from 'node:http';
import { createReadStream, accessSync, realpathSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN } from './site-config.mjs';

const root = realpathSync(fileURLToPath(new URL('./dist/', import.meta.url)));
accessSync(path.join(root, 'index.html'));
accessSync(path.join(root, '404.html'));
const canonicalHost = new URL(SITE_ORIGIN).hostname;
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf'
};

function reply(request, response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function encodePath(pathname) {
  const segments = pathname.split('/').filter(Boolean).map(encodeURIComponent);
  return '/' + segments.join('/') + (segments.length && pathname.endsWith('/') ? '/' : '');
}

async function findFile(filename) {
  try {
    const resolved = await realpath(filename);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
    return { filename: resolved, info: await stat(resolved) };
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES', 'ELOOP'].includes(error.code)) return null;
    throw error;
  }
}

function sendFile(request, response, file, status = 200) {
  const extension = path.extname(file.filename).toLowerCase();
  const etag = `W/"${file.info.size.toString(16)}-${Math.trunc(file.info.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': types[extension] || 'application/octet-stream',
    'Content-Length': file.info.size,
    'Cache-Control': extension === '.html' || !file.filename.startsWith(path.join(root, 'assets') + path.sep)
      ? 'no-cache' : 'public, max-age=3600',
    'Last-Modified': file.info.mtime.toUTCString()
  };
  if (status === 200) {
    headers.ETag = etag;
    const tags = String(request.headers['if-none-match'] || '').split(',').map(tag => tag.trim());
    if (tags.includes(etag) || tags.includes('*')) {
      delete headers['Content-Length'];
      response.writeHead(304, headers);
      response.end();
      return;
    }
  } else {
    headers['X-Robots-Tag'] = 'noindex';
  }
  response.writeHead(status, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  const stream = createReadStream(file.filename);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

async function notFound(request, response) {
  const file = await findFile(path.join(root, '404.html'));
  if (file?.info.isFile()) sendFile(request, response, file, 404);
  else reply(request, response, 404, 'Page not found.\n');
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      reply(request, response, 405, 'Method not allowed.\n', { Allow: 'GET, HEAD' });
      return;
    }

    const rawUrl = request.url || '/';
    if (!rawUrl.startsWith('/') || rawUrl.startsWith('//') || rawUrl.includes('#')) {
      reply(request, response, 400, 'Invalid request path.\n');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(rawUrl.split('?')[0]);
    } catch {
      reply(request, response, 400, 'Invalid request path.\n');
      return;
    }
    if (/[\u0000-\u001f\u007f\\]/.test(pathname)) {
      reply(request, response, 400, 'Invalid request path.\n');
      return;
    }
    if (pathname.split('/').some(part => part.startsWith('.')) || ['/_headers', '/_redirects'].includes(pathname)) {
      await notFound(request, response);
      return;
    }

    // A direct health response also works for Railway's healthcheck hostname.
    if (pathname === '/healthz') {
      reply(request, response, 200, '{"status":"ok"}\n', {
        'Content-Type': 'application/json; charset=utf-8', 'X-Robots-Tag': 'noindex'
      });
      return;
    }

    const url = new URL(rawUrl, SITE_ORIGIN);
    const host = String(request.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
    const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    // Do not force preview/healthcheck hosts onto the public domain. Only use an
    // explicit forwarded HTTP value for HTTPS upgrades behind the TLS proxy.
    if (host === `www.${canonicalHost}` || (host === canonicalHost && forwardedProto === 'http')) {
      reply(request, response, 308, 'Redirecting.\n', { Location: SITE_ORIGIN + url.pathname + url.search });
      return;
    }

    let file = await findFile(path.resolve(root, '.' + pathname));
    if (file?.info.isDirectory()) {
      file = await findFile(path.join(file.filename, 'index.html'));
      if (file?.info.isFile() && !pathname.endsWith('/')) {
        reply(request, response, 308, 'Redirecting.\n', { Location: encodePath(pathname + '/') + url.search });
        return;
      }
    }
    if (!file?.info.isFile() || ['_headers', '_redirects'].some(name => file.filename === path.join(root, name))) {
      await notFound(request, response);
      return;
    }
    if (pathname.endsWith('/index.html')) {
      reply(request, response, 308, 'Redirecting.\n', { Location: encodePath(pathname.slice(0, -10)) + url.search });
      return;
    }
    sendFile(request, response, file, file.filename === path.join(root, '404.html') ? 404 : 200);
  } catch (error) {
    console.error('Request failed:', error.code || error.message);
    if (!response.headersSent) reply(request, response, 500, 'Unable to serve this page.\n');
    else response.destroy();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'listening', address: '0.0.0.0', port: server.address().port, canonicalOrigin: SITE_ORIGIN }));
});
server.on('error', error => {
  console.error('Server failed:', error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
