import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = join(import.meta.dirname, '..', '.cache');

/**
 * Downloads are cached on disk and keyed by URL hash. Rebuilding the catalogue is
 * something we do repeatedly while tuning rarity scores or adding a list, and none
 * of these sources change more than a few times a year — re-pulling ~400MB of
 * GeoNames every run would make the pipeline unusable.
 */
export async function fetchCached(url: string, { maxAgeDays = 30 } = {}): Promise<Buffer> {
  mkdirSync(CACHE, { recursive: true });
  const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const path = join(CACHE, key);

  if (existsSync(path)) {
    const ageDays = (Date.now() - statSync(path).mtimeMs) / 86_400_000;
    if (ageDays < maxAgeDays) return readFileSync(path);
  }

  process.stdout.write(`  ↓ ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(path, buf);
  return buf;
}

/** GeoNames ships everything as a zip containing a single same-named .txt. */
export async function fetchZippedText(url: string, entryName: string): Promise<string> {
  const zip = new AdmZip(await fetchCached(url));
  const entry = zip.getEntry(entryName);
  if (!entry) throw new Error(`${entryName} not found in ${url}`);
  return entry.getData().toString('utf8');
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (init) {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
    return res.json() as Promise<T>;
  }
  return JSON.parse((await fetchCached(url)).toString('utf8')) as T;
}

/**
 * GeoNames dumps are tab-separated with no header and no quoting — a `#`-prefixed
 * comment block is the only thing to skip. Splitting on tab is correct here in a way
 * it would not be for real CSV.
 */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    rows.push(line.split('\t'));
  }
  return rows;
}
