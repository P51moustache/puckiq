import { mkdtempSync, writeFileSync, readFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const quote = (value) => '"' + String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';

// An App Store preview can take over 20 minutes on a slow upstream connection.
const DEFAULT_UPLOAD_TIMEOUT_SECONDS = 3600;

/** Upload an Apple-reserved binary part without exposing its signed URL in logs. */
export async function uploadPart(operation, bytes, timeoutSeconds = DEFAULT_UPLOAD_TIMEOUT_SECONDS) {
  const folder = mkdtempSync(join(tmpdir(), 'puckiq-asset-part-'));
  const data = join(folder, 'part.bin');
  const config = join(folder, 'curl.conf');
  const progressFile = join(folder, 'progress.log');
  writeFileSync(data, bytes, { mode: 0o600 });
  const headers = operation.requestHeaders.map(({ name, value }) => {
    if (/[\r\n]/.test(name + value)) throw new Error('Invalid upload header');
    return 'header = ' + quote(name + ': ' + value);
  });
  writeFileSync(config, [
    'url = ' + quote(operation.url),
    'request = ' + quote(operation.method),
    'data-binary = ' + quote('@' + data), ...headers,
    'show-error', 'fail', 'connect-timeout = 30',
    'ipv4', 'http1.1', 'retry = 2', 'retry-all-errors', 'retry-delay = 3',
    'max-time = ' + timeoutSeconds,
  ].join('\n'), { mode: 0o600 });
  const progressFd = openSync(progressFile, 'w', 0o600);
  let timer;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/curl', ['--config', config], { stdio: ['ignore', 'ignore', progressFd] });
      timer = setInterval(() => {
        const rows = readFileSync(progressFile, 'utf8').split(/[\r\n]+/).filter((line) => /^\s*\d+\s/.test(line));
        const latest = rows.at(-1);
        if (latest) console.log('Preview upload: ' + latest.trim());
      }, 30_000);
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`Binary upload failed (curl ${code})`)));
    });
  } finally { clearInterval(timer); closeSync(progressFd); rmSync(folder, { recursive: true, force: true }); }
}
