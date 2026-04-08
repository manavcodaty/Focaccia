import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REQUIRED_FACE_PASS_KEYS = [
  "FACE_PASS_SECRET_WRAPPING_KEY_B64URL",
];

const REQUIRED_SUPABASE_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL_FACE_PASS_KEYS = [
  "FACE_PASS_MATCH_THRESHOLD",
  "FACE_PASS_LIVENESS_TIMEOUT_MS",
  "FACE_PASS_QUEUE_CODE_DIGITS",
];

function parseEnv(text) {
  const values = new Map();

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values.set(key, value);
  }

  return values;
}

function serializeEnv(entries) {
  return `${entries.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

function generateWrappingKey() {
  return randomBytes(32).toString("base64url");
}

export function prepareFunctionsEnvFiles({ envExampleText, envLocalText }) {
  const envExample = parseEnv(envExampleText);
  const envLocal = parseEnv(envLocalText);
  const outputEntries = [];
  let generatedSecret = false;

  for (const key of REQUIRED_FACE_PASS_KEYS) {
    let value = envLocal.get(key);

    if (!value) {
      if (key === "FACE_PASS_SECRET_WRAPPING_KEY_B64URL") {
        value = generateWrappingKey();
        envLocal.set(key, value);
        generatedSecret = true;
      } else {
        throw new Error(`Missing required environment variable ${key}.`);
      }
    }

    outputEntries.push([key, value]);
  }

  for (const key of REQUIRED_SUPABASE_KEYS) {
    const value = envLocal.get(key);

    if (!value) {
      throw new Error(`Missing required environment variable ${key} in supabase/functions/.env.local.`);
    }

    const facePassKey = `FACE_PASS_${key}`;
    envLocal.set(facePassKey, value);
    outputEntries.push([facePassKey, value]);
  }

  for (const key of OPTIONAL_FACE_PASS_KEYS) {
    const value = envLocal.get(key) ?? envExample.get(key);

    if (!value) {
      throw new Error(`Missing default value for ${key} in supabase/functions/.env.example.`);
    }

    outputEntries.push([key, value]);
  }

  return {
    envText: serializeEnv(outputEntries),
    generatedSecret,
    updatedEnvLocalText: serializeEnv(Array.from(envLocal.entries())),
  };
}

function main() {
  const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const functionsDir = path.join(repoRoot, "supabase", "functions");
  const envExamplePath = path.join(functionsDir, ".env.example");
  const envLocalPath = path.join(functionsDir, ".env.local");
  const envPath = path.join(functionsDir, ".env");

  if (!existsSync(envExamplePath)) {
    throw new Error(`Missing ${envExamplePath}.`);
  }

  if (!existsSync(envLocalPath)) {
    throw new Error(`Missing ${envLocalPath}. Copy supabase/functions/.env.example to .env.local first.`);
  }

  const result = prepareFunctionsEnvFiles({
    envExampleText: readFileSync(envExamplePath, "utf8"),
    envLocalText: readFileSync(envLocalPath, "utf8"),
  });

  writeFileSync(envPath, result.envText, { encoding: "utf8", mode: 0o600 });
  writeFileSync(envLocalPath, result.updatedEnvLocalText, { encoding: "utf8", mode: 0o600 });
  chmodSync(envPath, 0o600);
  chmodSync(envLocalPath, 0o600);

  if (result.generatedSecret) {
    console.log("Generated FACE_PASS_SECRET_WRAPPING_KEY_B64URL in supabase/functions/.env.local.");
  }

  console.log("Wrote supabase/functions/.env for local Edge Functions.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
