import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Mobile guide is publishable and discoverable',()=>{
 const html=read('guide/mobile/index.html');
 const doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelector('link[rel="canonical"]').href,'https://hermesatlas.com/guide/mobile/');
 assert.equal(doc.querySelectorAll('h1').length,1);
 assert.ok(doc.getElementById("alex-finn-update"));
 assert.ok(doc.querySelector('a[href*="f_NfbjaSJ-k"]'));
 assert.ok(read("drafts/guide-mobile.md").includes("f_NfbjaSJ-k"));
 // Production CSP rejects inline CSS: use the maintained handbook shell.
 assert.equal(doc.querySelectorAll('style, [style]').length,0);
 for(const href of ['/assets/css/tokens.css','/assets/css/base.css','/assets/css/page.css']){
  assert.ok(doc.querySelector(`link[rel="stylesheet"][href="${href}"]`));
  assert.ok(fs.existsSync(new URL('../'+href.slice(1),import.meta.url)));
 }
 assert.ok(doc.querySelector('.masthead .mast-nav'));
 assert.ok(doc.querySelector('main.article .article-header'));
 assert.ok(doc.querySelector('.toc li a'));
 assert.ok(doc.querySelector('script[src="/assets/js/theme-toggle.js"]'));
 assert.ok(!html.includes('review draft')&&!html.includes('not published'));
 assert.ok(doc.querySelector('a[href="https://hermes-agent.nousresearch.com/mobile"]'));
 for(const a of doc.querySelectorAll('a[href^="#"]'))assert.ok(doc.getElementById(a.hash.slice(1)));
 JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
 assert.ok(read('guide/index.html').includes('href="/guide/mobile/"'));
 const home=new JSDOM(read('index.html')).window.document;
 assert.equal(home.querySelector('#report-banner a').getAttribute('href'),'/guide/mobile/');
 assert.equal(home.querySelector('.report-banner-badge').textContent,'new guide');
 assert.ok(read('sitemap.xml').includes('https://hermesatlas.com/guide/mobile/'));
 assert.ok(read('llms.txt').includes('/guide/mobile/'));
 assert.ok(read('llms-full.txt').includes('Canonical URL: https://hermesatlas.com/guide/mobile/'));
 assert.ok(read('scripts/build-chunks.js').includes('guide-mobile.md'));
});
