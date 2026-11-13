import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');

test('curator security reviews are not published in catalog or rendered surfaces',()=>{
 const repos=JSON.parse(read('data/repos.json'));
 for(const repo of repos){
  assert.ok(!Object.hasOwn(repo,'securityNote'),`${repo.owner}/${repo.repo}: keep review notes private`);
  assert.ok(!read(`projects/${repo.owner}/${repo.repo}.html`).includes('aria-label="Security note"'));
 }
 const home=new JSDOM(read('index.html')).window.document;
 const picks=JSON.parse(read('data/featured.json'));
 const feature=home.querySelector('.featured-week');
 assert.equal(feature.querySelector('.featured-week-name').getAttribute('href'),`/projects/${picks[0].slug}`);
 assert.ok(!feature.textContent.includes('Security note:'));
 assert.ok(!read('llms-full.txt').includes('Security note: Atlas reviewed'));
 assert.ok(!read('llms-full.txt').includes('Security note: Basic static screen:'));
 for(const script of ['scripts/build-pages.js','scripts/rotate-featured.js']){
  assert.ok(!read(script).includes('repo.securityNote'),`${script}: must not render private reviews`);
 }
});
