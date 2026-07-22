import http from 'node:http';
import net from 'node:net';
import { Transform } from 'node:stream';
import { pathToFileURL } from 'node:url';

const DEFAULT_BIND_HOST = '127.0.0.1';
const DEFAULT_BIND_PORT = 54331;
const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const UPSTREAM_HOST = '127.0.0.1';
const UPSTREAM_PORT = 54321;
const ALLOWED_PREFIXES = [
  '/auth/v1',
  '/functions/v1',
  '/realtime/v1',
  '/rest/v1',
  '/storage/v1',
];

export function isAllowedProxyPath(rawPath) {
  let pathname;

  try {
    pathname = new URL(rawPath, 'http://focaccia.local').pathname;
  } catch {
    return false;
  }

  return ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAllowedBrowserOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

function rejectHttp(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify({ error: message }));
}

function corsHeaders(origin, allowedOrigins) {
  return origin && allowedOrigins.includes(origin)
    ? {
        'Access-Control-Allow-Headers': [
          'accept-profile',
          'apikey',
          'authorization',
          'content-profile',
          'content-type',
          'idempotency-key',
          'prefer',
          'range',
          'x-client-info',
          'x-supabase-api-version',
          'x-supabase-client-platform',
          'x-supabase-client-version',
          'x-upsert',
        ].join(', '),
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {};
}

function sanitizeResponseHeaders(headers, origin, allowedOrigins) {
  const sanitized = { ...headers };

  for (const name of Object.keys(sanitized)) {
    if (name.toLowerCase().startsWith('access-control-') || name.toLowerCase() === 'vary') {
      delete sanitized[name];
    }
  }

  return { ...sanitized, ...corsHeaders(origin, allowedOrigins) };
}

function sanitizeHeaders(headers, upstreamHost, upstreamPort) {
  const sanitized = { ...headers };
  delete sanitized['proxy-authorization'];
  delete sanitized['proxy-connection'];
  delete sanitized['x-forwarded-host'];
  delete sanitized['x-forwarded-proto'];
  sanitized.host = `${upstreamHost}:${upstreamPort}`;
  return sanitized;
}

export function createLanSupabaseProxy({
  allowedOrigins = [],
  bindHost = DEFAULT_BIND_HOST,
  bindPort = DEFAULT_BIND_PORT,
  upstreamHost = UPSTREAM_HOST,
  upstreamPort = UPSTREAM_PORT,
} = {}) {
  const server = http.createServer((request, response) => {
    const requestPath = request.url ?? '/';

    if (requestPath === '/.focaccia/health' && (request.method === 'GET' || request.method === 'HEAD')) {
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
        'X-Focaccia-Proxy': '1',
      });
      response.end(request.method === 'HEAD'
        ? undefined
        : JSON.stringify({ service: 'focaccia-lan-supabase-proxy' }));
      return;
    }

    if (!isAllowedProxyPath(requestPath)) {
      rejectHttp(response, 404, 'Path is not available through the Focaccia LAN proxy.');
      return;
    }

    const origin = request.headers.origin ?? null;

    if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
      rejectHttp(response, 403, 'Browser origin is not allowed.');
      return;
    }

    if (request.method === 'OPTIONS' && origin) {
      response.writeHead(204, corsHeaders(origin, allowedOrigins));
      response.end();
      return;
    }

    const contentLength = Number(request.headers['content-length'] ?? '0');

    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      rejectHttp(response, 413, 'Request is too large.');
      return;
    }

    const upstream = http.request({
      headers: sanitizeHeaders(request.headers, upstreamHost, upstreamPort),
      host: upstreamHost,
      method: request.method,
      path: requestPath,
      port: upstreamPort,
    }, (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        sanitizeResponseHeaders(upstreamResponse.headers, origin, allowedOrigins),
      );
      upstreamResponse.pipe(response);
    });

    upstream.setTimeout(15_000, () => upstream.destroy(new Error('Upstream timeout.')));
    upstream.on('error', () => {
      if (!response.headersSent) {
        rejectHttp(response, 502, 'Local Supabase is unavailable.');
      } else {
        response.destroy();
      }
    });
    let receivedBytes = 0;
    const limiter = new Transform({
      transform(chunk, encoding, callback) {
        receivedBytes += chunk.length;

        if (receivedBytes > MAX_REQUEST_BYTES) {
          callback(new Error('Request is too large.'));
          return;
        }

        callback(null, chunk, encoding);
      },
    });
    limiter.on('error', () => {
      upstream.destroy();

      if (!response.headersSent) {
        rejectHttp(response, 413, 'Request is too large.');
      }
    });
    request.pipe(limiter).pipe(upstream);
  });

  server.on('upgrade', (request, socket, head) => {
    const requestPath = request.url ?? '/';
    const origin = request.headers.origin ?? null;

    if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }

    if (!isAllowedProxyPath(requestPath) || !requestPath.startsWith('/realtime/v1')) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }

    const upstream = net.connect(upstreamPort, upstreamHost, () => {
      const headers = Object.entries(sanitizeHeaders(request.headers, upstreamHost, upstreamPort))
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('\r\n');
      upstream.write(`${request.method ?? 'GET'} ${requestPath} HTTP/${request.httpVersion}\r\n${headers}\r\n\r\n`);
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });

    upstream.setTimeout(60_000, () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(bindPort, bindHost, () => {
        server.off('error', reject);
        resolve(server.address());
      });
    }),
    server,
  };
}

async function main() {
  const allowedOrigins = (process.env.FOCACCIA_ALLOWED_BROWSER_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const bindHost = process.env.FOCACCIA_LOCAL_HOST ?? DEFAULT_BIND_HOST;
  const bindPort = Number(process.env.FOCACCIA_LAN_PROXY_PORT ?? DEFAULT_BIND_PORT);
  const upstreamHost = process.env.FOCACCIA_SUPABASE_UPSTREAM_HOST ?? UPSTREAM_HOST;
  const upstreamPort = Number(process.env.FOCACCIA_SUPABASE_UPSTREAM_PORT ?? UPSTREAM_PORT);
  if (!['127.0.0.1', '::1', 'localhost'].includes(upstreamHost)) {
    throw new Error('Supabase proxy upstream must use a loopback host.');
  }
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65_535) {
    throw new Error('Supabase proxy upstream port is invalid.');
  }
  const proxy = createLanSupabaseProxy({
    allowedOrigins,
    bindHost,
    bindPort,
    upstreamHost,
    upstreamPort,
  });

  await proxy.listen();
  process.stdout.write(`Focaccia LAN proxy listening on http://${bindHost}:${bindPort}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Proxy startup failed.'}\n`);
    process.exitCode = 1;
  });
}
