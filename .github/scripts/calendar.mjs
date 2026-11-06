// Reads the public contribution calendar. No token needed.
export async function cells(user, query = '') {
  const res = await fetch(`https://github.com/users/${user}/contributions${query}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'profile-stats' },
  });
  if (!res.ok) throw new Error(`calendar ${res.status}`);
  const html = await res.text();
  const tips = new Map();
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) tips.set(m[1], m[2]);
  const found = [];
  for (const [cell] of html.matchAll(/<td\b[^>]*>/g)) {
    const date = cell.match(/data-date="([\d-]+)"/)?.[1];
    const id = cell.match(/\bid="([^"]+)"/)?.[1];
    if (!date || !id) continue;
    const count = tips.get(id)?.match(/^\s*([\d,]+) contribution/)?.[1];
    found.push({
      date,
      count: count ? Number(count.replace(/,/g, '')) : 0,
      level: Number(cell.match(/data-level="(\d)"/)?.[1] ?? 0),
    });
  }
  return found.sort((a, b) => a.date.localeCompare(b.date));
}

export async function calendar(user, query = '') {
  return new Map((await cells(user, query)).map((c) => [c.date, c.count]));
}
