#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { asc } from './asc.mjs';
import { uploadPart } from './upload_part.mjs';

const checksum = (bytes) => createHash('md5').update(bytes).digest('hex');

/** Reserve, upload each Apple-supplied part, and commit an app preview. */
async function upload(setId, file) {
  const bytes = readFileSync(file);
  const reserved = await asc('POST', '/v1/appPreviews', { data: {
    type: 'appPreviews',
    attributes: { fileName: basename(file), fileSize: bytes.length, mimeType: 'video/mp4' },
    relationships: { appPreviewSet: { data: { type: 'appPreviewSets', id: setId } } },
  } });
  const id = reserved.data.id;
  try {
    for (const part of reserved.data.attributes.uploadOperations) {
      await uploadPart(part, bytes.subarray(part.offset, part.offset + part.length));
      console.log(`Uploaded ${part.length} bytes for preview ${id}`);
    }
    await asc('PATCH', `/v1/appPreviews/${id}`, { data: { type: 'appPreviews', id,
      attributes: { uploaded: true, sourceFileChecksum: checksum(bytes), previewFrameTimeCode: '00:00:05:00' },
    } });
  } catch (error) {
    await asc('DELETE', `/v1/appPreviews/${id}`);
    throw error;
  }
  return { id, file: basename(file), checksum: checksum(bytes) };
}

async function main() {
  const [setId, file, replaceId, backup, evidence] = process.argv.slice(2);
  if (!setId || !file || !replaceId || !backup || !evidence) {
    throw new Error('upload-preview SET_ID FILE REPLACE_ID BACKUP_FILE EVIDENCE_JSON');
  }
  const configPath = process.env.ASC_CONFIG_PATH ?? join(homedir(), '.appstoreconnect', 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  Object.assign(process.env, { ASC_ISSUER_ID: config.issuerId, ASC_KEY_ID: config.keyId, ASC_KEY_PATH: config.keyPath });
  const set = await asc('GET', `/v1/appPreviewSets/${setId}?include=appPreviews`);
  const order = set.data.relationships.appPreviews.data;
  const replacing = replaceId !== '-';
  const original = set.included?.find((item) => item.id === replaceId);
  if (replacing && (!original || checksum(readFileSync(backup)) !== original.attributes.sourceFileChecksum)) {
    throw new Error('Replacement requires a verified local copy of the original preview');
  }
  // Apple permits three previews; retain a verified source to recover this replacement.
  if (replacing) await asc('DELETE', `/v1/appPreviews/${replaceId}`);
  let replacement;
  try { replacement = await upload(setId, file); }
  catch (error) {
    if (!replacing) throw error;
    const restored = await upload(setId, backup);
    await asc('PATCH', `/v1/appPreviewSets/${setId}/relationships/appPreviews`, {
      data: order.map((item) => item.id === replaceId ? { type: 'appPreviews', id: restored.id } : item),
    });
    throw new Error(`New preview failed; original restored as ${restored.id}: ${error.message}`);
  }
  await asc('PATCH', `/v1/appPreviewSets/${setId}/relationships/appPreviews`, {
    data: replacing ? order.map((item) => item.id === replaceId ? { type: 'appPreviews', id: replacement.id } : item)
      : [{ type: 'appPreviews', id: replacement.id }, ...order],
  });
  const result = { ...replacement, setId, replacedId: replaceId, uploadedAt: new Date().toISOString() };
  writeFileSync(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
