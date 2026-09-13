import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { compareManifests, manifestJson } from './recovery-manifest.mjs';

function usage() {
  return [
    'Usage: node scripts/diagnostics/recovery-compare.mjs --reference FILE --actual FILE [--out FILE]',
    '',
    'Reference is the reviewed/source-side manifest; actual is the stored-row manifest.',
    'The command only compares JSON. It never connects to or changes Supabase.',
  ].join('\n');
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index !== -1) return args[index + 1];
  const prefix = `${name}=`;
  return args.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return null;
  }
  const reference = option(args, '--reference');
  const actual = option(args, '--actual');
  if (!reference || !actual) throw new Error('Use --reference FILE and --actual FILE');
  const out = option(args, '--out');
  const allowed = new Set(['--help', '-h', '--reference', '--actual', '--out']);
  for (const arg of args) {
    const name = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (name.startsWith('-') && !allowed.has(name)) throw new Error(`Unknown option: ${arg}`);
  }
  return { reference, actual, out };
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON manifest ${file}: ${error.message}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) return;
  const result = compareManifests(await readJson(parsed.reference), await readJson(parsed.actual));
  const serialized = manifestJson(result);
  if (parsed.out) {
    await writeFile(parsed.out, serialized, { encoding: 'utf8', flag: 'wx' });
    console.error(`[recovery-compare] Read-only comparison complete: ${parsed.out}`);
  } else {
    process.stdout.write(serialized);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[recovery-compare] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
