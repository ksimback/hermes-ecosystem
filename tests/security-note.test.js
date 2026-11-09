import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

test('curator security note remains visible on project and featured surface', () => {
 const root=new URL('../',import.meta.url);
 const repos=JSON.parse(fs.readFileSync(new URL('data/repos.json',root)));
 const repo=repos.find(r=>r.owner==='rlaope' && r.repo==='oh-my-hermes');
 const page=new JSDOM(fs.readFileSync(new URL('projects/rlaope/oh-my-hermes.html',root),'utf8')).window.document;
 assert.equal(page.querySelector('[aria-label="Security note"] .summary-text').textContent,repo.securityNote);
 const picks=JSON.parse(fs.readFileSync(new URL('data/featured.json',root)));
 const picked=repos.find(r=>`${r.owner}/${r.repo}`===picks[0].slug);
 const home=new JSDOM(fs.readFileSync(new URL('index.html',root),'utf8')).window.document;
 const feature=home.querySelector('.featured-week');
 assert.equal(feature.querySelector('.featured-week-name').getAttribute('href'),`/projects/${picks[0].slug}`);
 if(picked.securityNote)assert.ok(feature.textContent.includes(picked.securityNote));
});
