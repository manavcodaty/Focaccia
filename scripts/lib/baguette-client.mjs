import crypto from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
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

class BaguetteInputSession {
  constructor(udid) {
    this.udid = udid;
    this.child = null;
    this.stdoutBuffer = '';
    this.pending = [];
  }

  async start() {
    this.child = spawn('baguette', ['input', '--udid', this.udid], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk) => this.#handleStdout(chunk));
    this.child.stderr.resume();
    this.child.on('error', (error) => this.#failPending(error));
    this.child.on('exit', (code, signal) => {
      if (code !== 0 || signal) {
        this.#failPending(new Error(`Baguette input session exited with ${code ?? signal ?? 'unknown status'}.`));
      } else {
        this.#failPending(new Error('Baguette input session exited before acknowledging the gesture.'));
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 250);
      this.child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  async dispatch(gesture, timeoutMs = 15_000) {
    if (!this.child || this.child.stdin.destroyed) {
      throw new Error('Baguette input session is not available.');
    }

    const ack = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = this.pending.filter((entry) => entry.resolve !== resolve);
        reject(new Error(`Timed out waiting for Baguette to acknowledge ${gesture.type}.`));
      }, timeoutMs);
      this.pending.push({ resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify(gesture)}\n`, (error) => {
        if (!error) return;
        clearTimeout(timer);
        this.pending = this.pending.filter((entry) => entry.resolve !== resolve);
        reject(error);
      });
    });

    if (!ack.ok) {
      throw new Error(`Baguette rejected ${gesture.type}: ${ack.error ?? 'unknown error'}`);
    }
    return ack;
  }

  async close() {
    const child = this.child;
    this.child = null;
    if (!child) return;
    child.stdin.end();
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
    if (!child.killed) child.kill('SIGTERM');
  }

  #handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let ack;
      try {
        ack = JSON.parse(line);
      } catch {
        this.#failPending(new Error(`Baguette input returned invalid JSON: ${line}`));
        return;
      }
      const entry = this.pending.shift();
      if (!entry) continue;
      clearTimeout(entry.timer);
      entry.resolve(ack);
    }
  }

  #failPending(error) {
    for (const entry of this.pending.splice(0)) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  }
}

let activeInputSession = null;

export async function startBaguetteInput(udid) {
  activeInputSession = new BaguetteInputSession(udid);
  try {
    await activeInputSession.start();
  } catch (error) {
    activeInputSession = null;
    throw error;
  }
}

export async function stopBaguetteInput() {
  const session = activeInputSession;
  activeInputSession = null;
  await session?.close();
}

async function runWithShortInputSession(udid, action) {
  const ownsSession = !activeInputSession;
  if (ownsSession) await startBaguetteInput(udid);
  try {
    return await action(activeInputSession);
  } finally {
    if (ownsSession) await stopBaguetteInput();
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
  let fallback = null;

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || node.hidden || node.enabled === false) {
      continue;
    }
    if (matchesNode(node, matcher)) {
      // React Native forms commonly expose a visible static label followed
      // by an AXTextField with the same accessibility label. Prefer the
      // interactive node so a semantic tap focuses the control rather than
      // landing on the text label.
      if (/^AX(?:Button|TextField|SecureTextField)$/.test(node.role ?? '')) {
        return node;
      }
      fallback ??= node;
    }
    if (Array.isArray(node.children)) {
      queue.push(...node.children);
    }
  }

  return fallback;
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

export async function waitForFocusedNode(udid, matcher, { timeoutMs = 10_000, label = String(matcher) } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const tree = await describeUi(udid);
      const node = findNode(tree, matcher);
      if (node?.focused) return node;
    } catch (error) {
      if (!isTransientAccessibilityError(error)) throw error;
    }
    await sleep(150);
  }

  throw new Error(`Timed out waiting for ${label} to receive focus.`);
}

async function tapAndFocusNode(udid, matcher, tapOptions, focusOptions) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await tapNode(udid, matcher, tapOptions);
    try {
      return await waitForFocusedNode(udid, matcher, focusOptions);
    } catch (error) {
      lastError = error;
      await sleep(400);
    }
  }

  throw lastError ?? new Error(`Unable to focus ${String(matcher)}.`);
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
    // After a tap, a React Native navigation transition can begin just after
    // the post-tap visibility check. Subsequent retry attempts must therefore
    // use a short probe; a full wait would turn a successful first tap into a
    // false timeout once the original node has disappeared.
    const attemptWaitOptions = attempt === 0
      ? waitOptions
      : { ...waitOptions, timeoutMs: Math.min(waitOptions.timeoutMs ?? 60_000, retryDelayMs) };
    let node;
    try {
      node = await waitForNode(udid, matcher, attemptWaitOptions);
    } catch (error) {
      if (attempt > 0) return lastNode;
      throw error;
    }
    lastNode = node;
    let frame = node.frame;
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

    // React Native ScrollViews report content coordinates in the
    // accessibility tree. A control can therefore be enabled and match the
    // requested label while still being below the simulator viewport. Use a
    // one-shot swipe so the cloud flow does not need a long-lived HID session.
    for (let scrollAttempt = 0; scrollAttempt < 10; scrollAttempt += 1) {
      const frameCenterY = frame.y + frame.height / 2;
      const visible = frameCenterY > 0 && frameCenterY < root.height;
      if (visible) break;
      const direction = frame.y >= root.height ? -1 : 1;
      const startY = direction < 0 ? root.height * 0.78 : root.height * 0.25;
      const endY = direction < 0 ? root.height * 0.25 : root.height * 0.78;
      await runCommand('baguette', [
        'swipe',
        '--udid', udid,
        '--start-x', String(root.width / 2),
        '--start-y', String(startY),
        '--end-x', String(root.width / 2),
        '--end-y', String(endY),
        '--width', String(root.width),
        '--height', String(root.height),
        '--duration', '0.25',
      ]);
      await sleep(350);
      node = await waitForNode(udid, matcher, { ...waitOptions, timeoutMs: Math.min(waitOptions.timeoutMs ?? 60_000, 5_000) });
      lastNode = node;
      const nextFrame = node.frame;
      if (!nextFrame) {
        throw new Error(`Accessibility node ${String(matcher)} lost its frame after scrolling.`);
      }
      frame = nextFrame;
    }

    const frameCenterY = frame.y + frame.height / 2;
    if (!(frameCenterY > 0 && frameCenterY < root.height)) {
      throw new Error(`Accessibility node ${String(matcher)} remained off-screen after scrolling.`);
    }

    const tap = {
      type: 'tap',
      x: frame.x + frame.width / 2,
      y: frame.y + frame.height / 2,
      width: root.width,
      height: root.height,
      duration: 0.1,
    };
    await runCommand('baguette', [
      'tap',
      '--udid', udid,
      '--x', String(tap.x),
      '--y', String(tap.y),
      '--width', String(tap.width),
      '--height', String(tap.height),
      '--duration', String(tap.duration),
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
  const { press = true, focusTimeoutMs = 10_000, ...tapOptions } = options;
  await runWithShortInputSession(udid, async (session) => {
    await tapAndFocusNode(udid, matcher, tapOptions, { timeoutMs: focusTimeoutMs });
    if (press) {
      await session.dispatch({ type: 'paste', text: value, press: true });
      return;
    }
    // Set the pasteboard without asking Baguette to press Cmd+V. A separate,
    // single key envelope avoids the repeated-paste gesture seen on hosted
    // iOS 26 simulators while retaining exact punctuation in credentials.
    await session.dispatch({ type: 'paste', text: value, press: false });
    await sleep(250);
    await session.dispatch({ type: 'key', code: 'KeyV', modifiers: ['command'] });
  });
}

export async function typeIntoNode(udid, matcher, value, options = {}) {
  const { focusTimeoutMs = 10_000, ...tapOptions } = options;
  await runWithShortInputSession(udid, async (session) => {
    await tapAndFocusNode(udid, matcher, tapOptions, { timeoutMs: focusTimeoutMs });
    // Hosted macOS simulator input can acknowledge a long `type` gesture
    // before UIKit has consumed every character. Dispatching one character at
    // a time keeps the semantic input path deterministic for credentials and
    // other short values used by the cloud flow.
    for (const character of value) {
      await session.dispatch({ type: 'type', text: character });
      await sleep(40);
    }
  });
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
        this.socket?.write(Buffer.concat([Buffer.from([0x8A, payload.length]), payload]));
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
        this.socket?.end();
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
