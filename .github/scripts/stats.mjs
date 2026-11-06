// Builds the stats card from the public contribution calendar. No token needed.
// Usage: node stats.mjs <github-user> <output.svg>
import fs from 'node:fs';
import path from 'node:path';
import { calendar } from './calendar.mjs';

const [, , user, out] = process.argv;

// Measured from my main repositories. Most of them are private, so the workflow token can't see them.
const LANGUAGES = [
  ['TypeScript', 68],
  ['HTML', 13],
  ['SQL', 7],
  ['CSS', 5],
  ['JavaScript', 5],
  ['Python', 2],
];

const C = {
  bg: '#0d1117',
  line: '#30363d',
  text: '#f0f6fc',
  muted: '#8b949e',
  green: ['#39d353', '#26a641', '#1a7f37', '#116329', '#6e7681', '#484f58'],
};

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const last = await calendar(user);
const dates = [...last.keys()].sort();
if (dates.length < 300) throw new Error('calendar looks wrong, keeping the old card');

const year = Number(dates.at(-1).slice(0, 4));
const history = new Map();
for (const y of [year - 2, year - 1, year]) {
  for (const [k, v] of await calendar(user, `?from=${y}-01-01&to=${y}-12-31`)) if (k.startsWith(String(y))) history.set(k, v);
}

const total = dates.reduce((n, d) => n + last.get(d), 0);
const activeDays = dates.filter((d) => last.get(d) > 0).length;
let before = 0;
for (let i = 1; i <= dates.length; i++) before += history.get(addDays(dates[0], -i)) ?? 0;
const growth = before > 0 ? total / before : 0;

let streak = 0;
let run = 0;
for (const d of dates) {
  run = last.get(d) > 0 ? run + 1 : 0;
  streak = Math.max(streak, run);
}

const end = new Date(`${dates.at(-1)}T00:00:00Z`);
const months = [];
for (let i = 11; i >= 0; i--) {
  const m = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1));
  const key = iso(m).slice(0, 7);
  months.push({
    name: m.toLocaleString('en', { month: 'long', timeZone: 'UTC' }),
    count: dates.filter((d) => d.startsWith(key)).reduce((n, d) => n + last.get(d), 0),
  });
}
const best = months.reduce((a, b) => (b.count > a.count ? b : a));

const W = 900;
const H = 396;
const text = (x, y, size, fill, value, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${value}</text>`;

const tiles = [
  [activeDays, 'active days'],
  [streak, 'day streak'],
  [best.count, `in ${best.name}`],
]
  .map(([n, label], i) => {
    const x = 32 + i * 112;
    return text(x, 232, 30, C.text, n, 'font-weight="600"') + text(x, 256, 14, C.muted, label);
  })
  .join('');

const BASE = 226;
const TALL = 150;
const BAR = 28;
const STEP = 41;
const LEFT = 380;
const bars = months
  .map((m, i) => {
    const x = LEFT + i * STEP;
    const h = Math.max(m.count > 0 ? 3 : 0, Math.round((m.count / best.count) * TALL));
    const top = m === best;
    return (
      `<rect class="bar" style="animation-delay:${i * 45}ms" x="${x}" y="${BASE - h}" width="${BAR}" height="${h}" rx="3" fill="${top ? C.green[0] : C.green[1]}"/>` +
      text(x + BAR / 2, BASE - h - 7, 13, top ? C.text : C.muted, m.count, `text-anchor="middle"${top ? ' font-weight="600"' : ''}`) +
      text(x + BAR / 2, BASE + 22, 13, C.muted, m.name[0], 'text-anchor="middle"')
    );
  })
  .join('');

const BAR_W = W - 64;
const sum = LANGUAGES.reduce((n, [, p]) => n + p, 0);
let at = 32;
const stack = LANGUAGES.map(([, p], i) => {
  const w = (p / sum) * BAR_W;
  const r = `<rect x="${at.toFixed(1)}" y="326" width="${w.toFixed(1)}" height="12" fill="${C.green[i]}"/>`;
  at += w;
  return r;
}).join('');
const legend = LANGUAGES.map(([name, p], i) => {
  const x = 32 + i * 141;
  return `<circle cx="${x + 5}" cy="363" r="5" fill="${C.green[i]}"/>` + text(x + 16, 368, 14, C.text, `${name}<tspan dx="6" fill="${C.muted}">${p}%</tspan>`);
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${total} contributions in the last 12 months, ${growth.toFixed(1)} times the year before">
<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}.bar{transform-box:fill-box;transform-origin:bottom;animation:grow .7s ease-out backwards}@keyframes grow{from{transform:scaleY(0)}}@media (prefers-reduced-motion:reduce){.bar{animation:none}}</style>
<clipPath id="r"><rect x="32" y="326" width="${BAR_W}" height="12" rx="6"/></clipPath>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="10" fill="${C.bg}" stroke="${C.line}"/>
${text(32, 48, 15, C.muted, 'Last 12 months')}
${text(32, 118, 68, C.text, total.toLocaleString('en'), 'font-weight="700"')}
${text(32, 148, 17, C.text, 'contributions')}
${growth > 1 ? text(32, 176, 17, C.green[0], `${growth.toFixed(1)}x the year before`, 'font-weight="600"') : ''}
${tiles}
${text(LEFT, 48, 15, C.muted, 'Per month')}
${bars}
<line x1="32" y1="282" x2="${W - 32}" y2="282" stroke="${C.line}"/>
${text(32, 312, 15, C.muted, 'Languages')}
<g clip-path="url(#r)">${stack}</g>
${legend}
</svg>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log({ total, before, growth: Number(growth.toFixed(2)), activeDays, streak, best });
