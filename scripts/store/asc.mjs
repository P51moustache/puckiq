#!/usr/bin/env node
/**
 * Minimal App Store Connect API client (no dependencies).
 *
 *   ASC_ISSUER_ID=... ASC_KEY_ID=S83SA4MA99 node scripts/store/asc.mjs <METHOD> <path> [json-body-file]
 *   e.g. node scripts/store/asc.mjs GET "/v1/apps?filter[bundleId]=com.zlce.hockeystats"
 *
 * The private key is read from ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 (or ASC_KEY_PATH)
 * and is never printed. Tokens live 15 minutes.
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const API = 'https://api.appstoreconnect.apple.com';

export function ascToken({ issuerId = process.env.ASC_ISSUER_ID, keyId = process.env.ASC_KEY_ID, keyPath = process.env.ASC_KEY_PATH } = {}) {
  if (!issuerId || !keyId) throw new Error('Set ASC_ISSUER_ID and ASC_KEY_ID');
  const path = keyPath || join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${keyId}.p8`);
  const key = createPrivateKey(readFileSync(path, 'utf8'));
  const b64 = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: keyId, typ: 'JWT' });
  const body = b64({ iss: issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' });
  const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${signature}`;
}

export async function asc(method, path, body) {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${ascToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.detail ?? e.title}`).join('\n') ?? text;
    throw new Error(`${method} ${path} -> ${res.status}\n${detail}`);
  }
  return json;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [method = 'GET', path = '/v1/apps', bodyFile] = process.argv.slice(2);
  const body = bodyFile ? JSON.parse(readFileSync(bodyFile, 'utf8')) : undefined;
  asc(method.toUpperCase(), path, body)
    .then((json) => console.log(JSON.stringify(json, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
