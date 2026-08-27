import mapshaper from 'mapshaper';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fetchCached } from './download.ts';

/**
 * Builds assets/data/countries.geojson — the polygons the Countries map fills in.
 *
 * The Cities map needs no geometry at all: visited cities render as MapLibre circle
 * features straight from their lat/lng, which is both lighter and sharper than any
 * polygon set we could ship. So this file is the app's only bundled geometry.
 *
 * Source: Natural Earth (public domain, no attribution required).
 */

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

const OUT_DIR = join(import.meta.dirname, '..', '..', 'assets', 'data');
const OUT_PATH = join(OUT_DIR, 'countries.geojson');

/**
 * Natural Earth encodes disputed or non-sovereign entries as ISO_A2 = '-99'. The
 * _EH variant resolves most of those (France, Norway, Kosovo, Somaliland) to the
 * code people expect, so prefer it and fall back through the alternatives.
 */
function isoOf(props: Record<string, any>): string | null {
  for (const key of ['ISO_A2_EH', 'ISO_A2', 'WB_A2', 'ADM0_A3']) {
    const v = props[key];
    if (typeof v === 'string' && v.length === 2 && v !== '-9') return v.toUpperCase();
  }
  return null;
}

async function main() {
  console.log('Building countries.geojson');
  mkdirSync(OUT_DIR, { recursive: true });

  const source = JSON.parse((await fetchCached(SOURCE, { maxAgeDays: 180 })).toString('utf8'));

  // Natural Earth carries ~90 attribute columns per feature — names in a dozen
  // languages, economy codes, label anchor points. The map needs exactly one: the
  // ISO code to join against the visited set. Dropping the rest is most of the
  // size win, before simplification does anything at all.
  const features = [];
  let skipped = 0;
  for (const f of source.features) {
    const id = isoOf(f.properties ?? {});
    if (!id) {
      skipped++;
      continue;
    }
    features.push({ type: 'Feature', properties: { id }, geometry: f.geometry });
  }

  console.log(`  ${features.length} features (${skipped} without a usable ISO code)`);

  const stripped = JSON.stringify({ type: 'FeatureCollection', features });

  // keep-shapes stops small island nations from being simplified out of existence —
  // without it Tuvalu and Nauru vanish, and they are exactly the countries a
  // completionist most wants to see filled in.
  const result = await mapshaper.applyCommands(
    '-i in.json -simplify 15% keep-shapes -clean -o out.json format=geojson precision=0.001',
    { 'in.json': stripped }
  );

  const output = result['out.json'];
  if (!output) throw new Error('mapshaper produced no output — check the command string');
  writeFileSync(OUT_PATH, output);

  console.log(
    `\n✓ ${OUT_PATH}\n  ${(statSync(OUT_PATH).size / 1e6).toFixed(2)} MB (from ${(stripped.length / 1e6).toFixed(2)} MB stripped)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
