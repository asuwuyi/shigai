(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.ShiGaiMemoryWorks=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function imageAsset(value){if(typeof value!=='string')return '';const path=value.trim();return path.startsWith('assets/')&&!/[\\%?#\u0000-\u001f]/.test(path)&&!path.split('/').some(part=>part==='..'||part==='.')&&/\.(?:webp|png|jpe?g|gif|avif)$/i.test(path)?path:'';}
function candidates(works){const result=[],ids=new Set(),artworks=new Set(),paths=new Set();for(const work of Array.isArray(works)?works:[]){if(work?.status!=='published'||typeof work.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(work.id)||ids.has(work.id))continue;
 const outputs=work.media?.optimized?.outputs||{};const sources=[...new Set([outputs.poster,work.thumbnail,...(['image','gif'].includes(work.type)?[outputs.primary,work.file]:[])].map(imageAsset).filter(Boolean))];if(!sources.length)continue;
 const hash=work.media?.optimized?.sourceHash;const key=typeof hash==='string'&&/^[a-f0-9]{64}$/i.test(hash)?hash:sources[0];if(artworks.has(key)||paths.has(sources[0]))continue;ids.add(work.id);artworks.add(key);paths.add(sources[0]);
 result.push({id:'work-'+work.id,workId:work.id,name:typeof work.title==='string'&&work.title.trim()?work.title.trim().slice(0,80):'作品 '+work.id,symbol:'▧',color:'#648474',sources});
 }return result;}
return Object.freeze({imageAsset,candidates});
});
