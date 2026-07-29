#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const target = resolve(root, "contracts/openapi.json");
const expectedVersion = "0.12.0";
const defaultLocalSource = resolve(
  root,
  "..",
  "vouch-personal-connections",
  "src/contracts/openapi.json",
);
const liveSource =
  "https://vtksaywymoftfhfnukxt.supabase.co/functions/v1/api-v1/contracts/openapi.json";

async function readSource() {
  const configured = process.env.VOUCH_CONTRACT_SOURCE;

  if (configured) {
    if (/^https?:\/\//.test(configured)) {
      const response = await fetch(configured);
      if (!response.ok) {
        throw new Error(
          `Unable to fetch contract (${response.status}).`,
        );
      }
      return await response.text();
    }

    return readFileSync(resolve(root, configured), "utf8");
  }

  if (existsSync(defaultLocalSource)) {
    return readFileSync(defaultLocalSource, "utf8");
  }

  const response = await fetch(liveSource);
  if (!response.ok) {
    throw new Error(
      `Unable to fetch live contract (${response.status}).`,
    );
  }
  return await response.text();
}

const raw = await readSource();
const parsed = JSON.parse(raw);
const version = parsed?.info?.version;

if (version !== expectedVersion) {
  throw new Error(
    `Expected contract ${expectedVersion}, received ${String(version)}.`,
  );
}

const normalized = `${JSON.stringify(parsed, null, 2)}\n`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, normalized);

const sha = createHash("sha256")
  .update(normalized)
  .digest("hex");

console.log(`Synced contract ${version}`);
console.log(`SHA256 ${sha}`);
console.log(target);
