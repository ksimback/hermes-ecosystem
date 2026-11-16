import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Mobile guide explains the backend directly and embeds every cited video/post',()=>{
 const doc=new JSDOM(read('guide/mobile/index.html')).window.document;
 const paragraph=doc.getElementById('what').nextElementSibling.nextElementSibling.textContent;
 assert.ok(paragraph.includes('phone interface versus agent runtime'));
 assert.ok(paragraph.includes('backend'));
 assert.ok(!/Tonbi|tour|Neither is evidence/.test(paragraph));
 const videos=[...doc.querySelectorAll('.video-embed iframe')];
 assert.equal(videos.length,2);
 assert.deepEqual(videos.map(f=>new URL(f.src).pathname.split('/').pop()).sort(),['7hbT1EzTquI','f_NfbjaSJ-k'].sort());
 const posts=[...doc.querySelectorAll('.x-embed iframe')];
 assert.equal(posts.length,3);
 assert.deepEqual(posts.map(f=>new URL(f.src).searchParams.get('id')).sort(),['2117696344756252822','2119851439904510217','2114340383044063552'].sort());
 for(const f of [...videos,...posts]){
  assert.ok(f.title);assert.equal(f.getAttribute('loading'),'lazy');
 }
 for(const a of doc.querySelectorAll('main a[href]')){
  if(/youtube\.com|youtu\.be|x\.com\/.*status/.test(a.href))assert.ok(a.closest('.media-fallback'),'external media links are fallback-only');
 }
 assert.ok(doc.querySelectorAll('[data-video-start]').length>10);
 assert.ok(doc.querySelector('script[src="/assets/js/guide-media.js"]'));
 assert.ok(doc.querySelector('link[href="/assets/css/guide-media.css"]'));
 const config=JSON.parse(read('vercel.json'));
 const policy=config.headers.find(h=>h.source==='/guide/mobile(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.ok(policy.includes('frame-src https://www.youtube-nocookie.com https://platform.twitter.com'));
 assert.ok(!policy.includes('unsafe-inline'));
});

test('embedded-video chapter controls seek locally and X resize validates sender',()=>{
 const dom=new JSDOM(read('guide/mobile/index.html'),{url:'https://hermesatlas.com/guide/mobile/',runScripts:'outside-only'});
 const {window:w}=dom;w.HTMLElement.prototype.scrollIntoView=function(){};
 w.eval(read('assets/js/guide-media.js'));
 const a=w.document.querySelector('[data-video-start="116"]');
 a.click();
 assert.equal(new URL(w.document.querySelector('#video-f_NfbjaSJ-k iframe').src).searchParams.get('start'),'116');
 const frame=w.document.querySelector('.x-embed iframe');
 const message={origin:'https://platform.twitter.com',source:frame.contentWindow,data:{'twttr.embed':{method:'twttr.private.resize',params:[{height:740}]}}};
 w.dispatchEvent(new w.MessageEvent('message',{...message,origin:'https://evil.example'}));
 assert.notEqual(frame.getAttribute('height'),'764');
 w.dispatchEvent(new w.MessageEvent('message',message));
 assert.equal(frame.getAttribute('height'),'764');
 w.dispatchEvent(new w.MessageEvent('message',{...message,data:{'twttr.embed':{method:'twttr.private.resize',params:[{height:999999}]}}}));
 assert.equal(frame.getAttribute('height'),'764');
 dom.window.close();
});
