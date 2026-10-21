(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShiGaiSocialLinks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const legacy = [
    ['email','Email','mailto:notartist@gmail.com'],
    ['facebook','Facebook','https://www.facebook.com/shigaihome/'],
    ['instagram','Instagram','https://www.instagram.com/shigaishigai/'],
    ['twitter','Twitter','https://twitter.com/shigai'],
    ['youtube','YouTube','https://www.youtube.com/channel/UC6j6u6M-FPvFFJISoydRQ1A'],
    ['giphy','GIPHY','https://giphy.com/shigai'],
    ['line-store','LINE STORE','https://store.line.me/stickershop/author/4968/zh-Hant'],
    ['behance','Behance','https://www.behance.net/r451']
  ];
  const text = (v,n=100) => String(v ?? '').trim().slice(0,n);
  const number = (v,f,min,max) => Number.isFinite(Number(v)) ? Math.min(max,Math.max(min,Number(v))) : f;
  function safeUrl(v) {
    const s = text(v,1000);
    if (/^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+$/i.test(s)) return s;
    try { const u = new URL(s); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
  }
  function safeIcon(v) {
    const s=text(v,500);
    return /^assets\/site\/brand\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|svg)$/i.test(s) && !s.split('/').includes('..') ? s : '';
  }
  function normalize(value, about={}) {
    const source=value && typeof value==='object' ? value : {};
    // Missing registry migrates the old site's assets; an explicitly empty array stays empty.
    const items=Array.isArray(source.items) ? source.items : legacy.map(([id,label,url]) => ({id,label,url: id==='email' && about.email ? `mailto:${about.email}` : about[id] || url,icon:`assets/site/brand/social-legacy/${id}.svg`}));
    const seen=new Set();
    return {
      enabled:source.enabled!==false,
      position:['after-intro','after-services','after-contact'].includes(source.position)?source.position:'after-contact',
      desktop:layout(source.desktop,56), mobile:layout(source.mobile,48),
      items:items.slice(0,24).map((v,index)=>{
        v=v && typeof v==='object'?v:{};
        let id=text(v.id,80).replace(/[^a-zA-Z0-9_-]/g,'') || `social-${index+1}`;
        while(seen.has(id)) id+='-copy'; seen.add(id);
        return {id,label:text(v.label),description:text(v.description,200),url:safeUrl(v.url),icon:safeIcon(v.icon),enabled:v.enabled!==false};
      })
    };
  }
  function layout(v,size) {v=v||{};return {align:['left','center','right'].includes(v.align)?v.align:'center',size:number(v.size,size,44,96),gap:number(v.gap,12,4,32),offsetY:number(v.offsetY,0,-24,48)};}
  return {normalize,safeUrl,safeIcon};
});
