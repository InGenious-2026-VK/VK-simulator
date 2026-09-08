/**
 * Builds public/data/population-density.json from the WorldPop Sweden extract.
 *
 * Input : data/polulation_density/swe_pd_2020_1km_ASCII_XYZ.csv  (repo root)
 *         WorldPop 2020, 1 km population density, XYZ ASCII (X=lon, Y=lat, Z=people/km²).
 *         © WorldPop (https://www.worldpop.org), CC BY 4.0.
 * Output: Implementation/public/data/population-density.json
 *         { source, note, resKm, maxDensity, cells: [[lng, lat, peoplePerKm2], …] }
 *
 * Cells are binned to ~1.5 km, clipped to the Östergötland boundary polygon,
 * and cells below 1 person/km² are dropped. Re-run after changing the boundary:
 *
 *   node Implementation/scripts/extract-population-density.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const CSV = path.join(repoRoot, 'data/polulation_density/swe_pd_2020_1km_ASCII_XYZ.csv');
const BOUNDARY = path.join(here, '../src/data/ostergotland-boundary.json');
const OUT = path.join(here, '../public/data/population-density.json');

const BIN_X = 0.024; // ≈ 1.5 km lon at ~58° N
const BIN_Y = 0.0135; // ≈ 1.5 km lat
const MIN_DENSITY = 1;

const ring = JSON.parse(fs.readFileSync(BOUNDARY, 'utf8')).features[0].geometry.coordinates[0];
let west = 180, east = -180, south = 90, north = -90;
for (const [x, y] of ring) {
  if (x < west) west = x;
  if (x > east) east = x;
  if (y < south) south = y;
  if (y > north) north = y;
}

function insideBoundary(x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const bins = new Map();
const rl = readline.createInterface({ input: fs.createReadStream(CSV) });
let line = 0;
let kept = 0;

rl.on('line', (l) => {
  if (line++ === 0) return; // header
  const c = l.split(',');
  const x = +c[0], y = +c[1], z = +c[2];
  if (x < west || x > east || y < south || y > north || z <= 0.05) return;
  if (!insideBoundary(x, y)) return;
  kept++;
  const key = Math.floor(x / BIN_X) + '_' + Math.floor(y / BIN_Y);
  let b = bins.get(key);
  if (!b) bins.set(key, (b = { sx: 0, sy: 0, sumZ: 0, n: 0 }));
  b.sx += x;
  b.sy += y;
  b.sumZ += z;
  b.n += 1;
});

rl.on('close', () => {
  const cells = [];
  let maxDensity = 0;
  for (const b of bins.values()) {
    const density = Math.round(b.sumZ / b.n);
    if (density < MIN_DENSITY) continue;
    if (density > maxDensity) maxDensity = density;
    cells.push([
      Math.round((b.sx / b.n) * 1e3) / 1e3,
      Math.round((b.sy / b.n) * 1e3) / 1e3,
      density,
    ]);
  }
  cells.sort((a, b) => a[2] - b[2]);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: 'WorldPop 2020, 1 km resolution population density (© WorldPop, CC BY 4.0)',
      note: 'Binned to ~1.5 km, clipped to the Östergötland boundary. Each cell is [lng, lat, people per km²].',
      resKm: 1.5,
      maxDensity,
      cells,
    })
  );

  console.log(
    `source cells kept: ${kept}\nbins written:      ${cells.length}\nmax density:       ${maxDensity}\noutput:            ${path.relative(repoRoot, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`
  );
});
