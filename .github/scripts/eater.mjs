// Draws the contribution graph with a single eater that clears it cell by cell.
// Usage: node eater.mjs <github-user> <output-dir>
// Everything runs on one clock: a cell empties at the exact moment the eater reaches it.
// One file for both themes: GitHub breaks <picture> inside a link, and a plain image opens its file when clicked.
import fs from 'node:fs';
import path from 'node:path';
import { cells } from './calendar.mjs';

const [, , user, outDir] = process.argv;

const STEP = 16;
const SIZE = 12;
const SPEED = 240; // px per second
const MOVING = 0.92; // share of the loop the eater is on screen
const REFILL = 0.96; // the graph fades back in from here to the end of the loop

const days = await cells(user);
if (days.length < 300) throw new Error('calendar looks wrong, keeping the old graph');

const offset = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
const grid = days.map((d, i) => ({ col: Math.floor((i + offset) / 7), row: (i + offset) % 7, level: d.level }));
const cols = grid.at(-1).col + 1;
const W = cols * STEP + 4;
const H = 7 * STEP + 4;
const center = (n) => n * STEP + 2 + SIZE / 2;

// Route: column by column, down one and up the next, stopping only at cells with contributions.
const points = [[center(-2), center(3)]];
let walked = 0;
const reach = (x, y) => {
  const [px, py] = points.at(-1);
  walked += Math.abs(x - px) + Math.abs(y - py);
  points.push([x, y]);
};
for (let col = 0; col < cols; col++) {
  const food = grid.filter((c) => c.col === col && c.level > 0).sort((a, b) => (col % 2 ? b.row - a.row : a.row - b.row));
  for (const cell of food) {
    const [px, py] = points.at(-1);
    if (center(cell.row) !== py) reach(px, center(cell.row));
    if (center(col) !== px) reach(center(col), center(cell.row));
    cell.at = walked;
  }
}
reach(center(cols + 2), points.at(-1)[1]);

const loop = (walked / SPEED / MOVING).toFixed(3);
const route = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`;

const R = 8;
const mouth = (deg) => {
  const a = (deg * Math.PI) / 180;
  const x = (R * Math.cos(a)).toFixed(2);
  const y = (R * Math.sin(a)).toFixed(2);
  return `M0 0 L${x} ${-y} A${R} ${R} 0 1 0 ${x} ${y} Z`;
};

const box = (c, cls, inner = '') => `<rect class="${cls}" x="${c.col * STEP + 2}" y="${c.row * STEP + 2}" width="${SIZE}" height="${SIZE}" rx="2">${inner}</rect>`;
const empties = grid.map((c) => box(c, 'l0')).join('');
const food = grid
  .filter((c) => c.at !== undefined)
  .map((c) => {
    const at = (c.at / walked) * MOVING;
    return box(c, `l${c.level}`, `<animate attributeName="opacity" dur="${loop}s" repeatCount="indefinite" keyTimes="0;${at.toFixed(5)};${(at + 0.0004).toFixed(5)};${REFILL};1" values="1;1;0;0;1"/>`);
  })
  .join('');
const eater = `<path id="eater" class="eater" d="${mouth(40)}"><animate attributeName="d" dur=".32s" repeatCount="indefinite" values="${mouth(40)};${mouth(4)};${mouth(40)}"/><animateMotion dur="${loop}s" repeatCount="indefinite" path="${route}" rotate="auto" calcMode="linear" keyPoints="0;1;1" keyTimes="0;${MOVING};1"/></path>`;

// See-through colors read on both the dark and the light page, whatever the visitor's system theme is.
const style = `.l0{fill:#8b949e;fill-opacity:.16}.l1{fill:#39d353;fill-opacity:.38}.l2{fill:#39d353;fill-opacity:.58}.l3{fill:#39d353;fill-opacity:.78}.l4{fill:#39d353}.eater{fill:#f0f6fc;stroke:#24292f;stroke-width:1.5}`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'contributions.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution graph being eaten cell by cell"><style>${style}</style>${empties}${food}${eater}</svg>\n`);
console.log({ cols, food: grid.filter((c) => c.at !== undefined).length, loop: Number(loop) });
