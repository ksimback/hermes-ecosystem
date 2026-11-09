import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/css/index.css', import.meta.url), 'utf8');

test('one disclosed Preferly placement sits between journey doors and stats', () => {
  assert.equal((html.match(/<aside class="atlas-sponsor"/g) || []).length, 1);
  const doorsEnd = html.indexOf('</section>', html.indexOf('<section class="doors"'));
  const sponsor = html.indexOf('<aside class="atlas-sponsor"');
  const stats = html.indexOf('<section class="stats-row"');
  const featured = html.indexOf('<!-- BEGIN featured-week');
  assert.ok(doorsEnd < sponsor && sponsor < stats && stats < featured);
  assert.match(html, /<div class="atlas-sponsor-label">Sponsored<\/div>/);
  assert.match(html, /href="https:\/\/preferly\.ai\/\?utm_source=hermesatlas&amp;utm_medium=sponsorship&amp;utm_campaign=homepage-preview" rel="sponsored noopener noreferrer"/);
  assert.match(css, /\.atlas-sponsor-cta:focus-visible/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.atlas-sponsor \{ grid-template-columns: 1fr/);
});
