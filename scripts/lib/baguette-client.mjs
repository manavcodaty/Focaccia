import crypto from 'node:crypto';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function commandError(error, command) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
  return new Error(`${command} failed${stderr ? `: ${stderr}` : '.'}`, { cause: error });
}

export async function runCommand(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    throw commandError(error, `${command} ${args.join(' ')}`);
  }
}

export async function describeUi(udid) {
  const { stdout } = await runCommand('baguette', ['describe-ui', '--udid', udid]);
  return JSON.parse(stdout);
}

function nodeText(node) {
  return [node.label, node.title, node.value, node.identifier]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

function matchesNode(node, matcher) {
  if (matcher instanceof RegExp) {
    return matcher.test(nodeText(node));
  }

  return node.label === matcher || node.title === matcher || node.value === matcher || node.identifier === matcher;
}

export function findNode(tree, matcher) {
  const queue = [tree?.tree ?? tree];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || node.hidden || node.enabled === false) {
      continue;
    }
    if (matchesNode(node, matcher)) {
      return node;
    }
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }

  return null;
}

function isTransientAccessibilityError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /no frontmost application|no accessibility data|sim not booted/i.test(message);
}

export async function waitForNode(udid, matcher, { timeoutMs = 60_000, label = String(matcher) } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastTree = null;

  while (Date.now() < deadline) {
    try {
      lastTree = await describeUi(udid);
    } catch (error) {
      // simctl launch can return before the Accessibility bridge has a
      // frontmost application. Treat that short startup window as retryable;
      // preserve all other baguette failures as hard errors.
      if (!isTransientAccessibilityError(error)) throw error;
      await sleep(500);
      continue;
    }
    const node = findNode(lastTree, matcher);
    if (node) {
      return node;
    }
    await sleep(300);
  }

  const visibleText = [];
  const collect = (node) => {
    if (!node || node.hidden) return;
    const text = nodeText(node);
    if (text) visibleText.push(text);
    for (const child of node.children ?? []) collect(child);
  };
  collect(lastTree?.tree ?? lastTree);
  throw new Error(`Timed out waiting for ${label}. Visible accessibility text: ${visibleText.slice(0, 80).join(' | ')}`);
}

export async function tapNode(udid, matcher, options = {}) {
  const {
    retryIfStillVisible = false,
    retryCount = 3,
    retryDelayMs = 250,
    ...waitOptions
  } = options;
  const attempts = retryIfStillVisible ? retryCount : 1;
  let lastNode = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const node = await waitForNode(udid, matcher, waitOptions);
    lastNode = node;
    const frame = node.frame;
    const root = (await describeUi(udid))?.tree?.frame ?? { width: 402, height: 874 };
    if (
      !frame
      || !Number.isFinite(frame.x)
      || !Number.isFinite(frame.y)
      || !Number.isFinite(frame.width)
      || !Number.isFinite(frame.height)
      || frame.width <= 0
      || frame.height <= 0
    ) {
      throw new Error(`Accessibility node ${String(matcher)} has no tappable frame.`);
    }

    await runCommand('baguette', [
      'tap',
      '--udid', udid,
      '--x', String(frame.x + frame.width / 2),
      '--y', String(frame.y + frame.height / 2),
      '--width', String(root.width),
      '--height', String(root.height),
    ]);

    if (!retryIfStillVisible) {
      return node;
    }

    await sleep(retryDelayMs);
    try {
      await waitForNode(udid, matcher, { ...waitOptions, timeoutMs: retryDelayMs });
    } catch {
      return node;
    }
  }

  return lastNode;
}

export async function pasteIntoNode(udid, matcher, value, options = {}) {
  await tapNode(udid, matcher, options);
  await runCommand('baguette', ['paste', '--udid', udid, '--text', value]);
}

export async function readSimulatorClipboard(udid) {
  const { stdout } = await runCommand('baguette', ['clipboard', 'get', '--udid', udid]);
  return stdout.trim();
}

export async function launchSimulatorApp(udid, bundleId) {
  await runCommand('xcrun', ['simctl', 'launch', '--terminate-running-process', udid, bundleId]);
}

export async function grantCameraAccess(udid, bundleId) {
  await runCommand('xcrun', ['simctl', 'privacy', udid, 'grant', 'camera', bundleId]);
}

export async function installSimulatorApp(udid, appPath) {
  await runCommand('xcrun', ['simctl', 'install', udid, appPath]);
}

export async function takeSimulatorScreenshot(udid, outputPath) {
  await runCommand('baguette', ['screenshot', '--udid', udid, '--output', outputPath]);
}

function maskedWebSocketFrame(message) {
  const payload = Buffer.from(message);
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65_536) {
    header = Buffer.from([0x81, 0xFE, payload.length >> 8, payload.length & 0xFF]);
  } else {
    throw new Error('Baguette camera control messages must be shorter than 64 KiB.');
  }
  const masked = Buffer.allocUnsafe(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

class CameraWebSocket {
  constructor({ host, port, udid }) {
    this.host = host;
    this.port = port;
    this.udid = udid;
    this.buffer = Buffer.alloc(0);
    this.messages = [];
    this.waiters = [];
    this.upgraded = false;
    this.socket = null;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = net.connect(this.port, this.host);
      this.socket = socket;
      socket.setTimeout(15_000, () => socket.destroy(new Error('Baguette camera WebSocket connection timed out.')));
      const key = crypto.randomBytes(16).toString('base64');
      socket.on('connect', () => {
        socket.write([
          `GET /simulators/${this.udid}/camera HTTP/1.1`,
          `Host: ${this.host}:${this.port}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });
      socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.parseFrames();
        if (this.upgraded) resolve();
      });
      socket.on('error', reject);
      socket.on('close', () => {
        if (!this.upgraded) reject(new Error('Baguette camera WebSocket closed during handshake.'));
        for (const waiter of this.waiters.splice(0)) waiter.reject(new Error('Baguette camera WebSocket closed.'));
      });
    });
    await this.waitForMessage((message) => message.type === 'camera_devices', 10_000);
  }

  parseFrames() {
    if (!this.upgraded) {
      const marker = this.buffer.indexOf('\r\n\r\n');
      if (marker < 0) return;
      const header = this.buffer.subarray(0, marker).toString();
      this.buffer = this.buffer.subarray(marker + 4);
      if (!/^HTTP\/1\.1 101 /m.test(header)) {
        throw new Error(`Baguette camera WebSocket upgrade failed: ${header}`);
      }
      this.upgraded = true;
    }

    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      let length = second & 0x7F;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        throw new Error('Baguette camera sent an unsupported large WebSocket frame.');
      }
      if (this.buffer.length < offset + length) return;
      let payload = this.buffer.subarray(offset, offset + length);
      this.buffer = this.buffer.subarray(offset + length);
      if (second & 0x80) {
        throw new Error('Baguette camera sent a masked server frame.');
      }
      const opcode = first & 0x0F;
      if (opcode === 0x09) {
        this.socket.write(Buffer.concat([Buffer.from([0x8A, payload.length]), payload]));
      } else if (opcode === 0x01) {
        const message = JSON.parse(payload.toString());
        this.messages.push(message);
        for (const waiter of [...this.waiters]) {
          if (waiter.predicate(message)) {
            this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
            waiter.resolve(message);
          }
        }
      } else if (opcode === 0x08) {
        this.socket.end();
        return;
      }
    }
  }

  send(message) {
    if (!this.socket || !this.upgraded) throw new Error('Baguette camera WebSocket is not connected.');
    this.socket.write(maskedWebSocketFrame(JSON.stringify(message)));
  }

  waitForMessage(predicate, timeoutMs, afterIndex = 0) {
    const existing = this.messages.slice(afterIndex).find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter !== entry);
        reject(new Error('Timed out waiting for a Baguette camera state message.'));
      }, timeoutMs);
      const entry = {
        predicate,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      this.waiters.push(entry);
    });
  }

  async close() {
    if (!this.socket) return;
    try {
      this.send({ type: 'camera_stop' });
      await this.waitForMessage((message) => message.type === 'camera_state' && message.phase === 'idle', 5_000);
    } catch {
      // The server's close path also stops and disarms the virtual camera.
    }
    this.socket.end();
    this.socket = null;
  }
}

export class BaguetteCamera {
  constructor({ baseUrl = 'http://127.0.0.1:8421', udid }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.udid = udid;
    const parsed = new URL(this.baseUrl);
    this.host = parsed.hostname;
    this.port = Number(parsed.port || 80);
    this.socket = null;
  }

  async uploadImage(imagePath) {
    const bytes = await readFile(imagePath);
    const name = imagePath.split('/').at(-1) || 'camera-fixture.png';
    const response = await fetch(
      `${this.baseUrl}/simulators/${this.udid}/camera-source?name=${encodeURIComponent(name)}`,
      {
        body: bytes,
        headers: { 'Content-Type': 'application/octet-stream' },
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Baguette rejected camera image ${name}: HTTP ${response.status} ${await response.text()}`);
    }
  }

  async start() {
    if (!this.socket) {
      this.socket = new CameraWebSocket({ host: this.host, port: this.port, udid: this.udid });
      await this.socket.connect();
    }
    const messageIndex = this.socket.messages.length;
    this.socket.send({ fit: 'fit', mirror: false, source: 'image', type: 'camera_start' });
    await this.socket.waitForMessage(
      (message) => message.type === 'camera_state' && message.phase === 'streaming',
      10_000,
      messageIndex,
    );
  }

  async stop() {
    await this.socket?.close();
    this.socket = null;
  }
}
