// One release policy for Studio, public projections and package generation.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShiGaiReleaseTargets=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const scopes=Object.freeze(['test','production','off']);
function target(value='test'){if(!['test','production'].includes(value))throw Error('預覽／發布目標不正確。');return value;}
function scope(game){if(game.releaseScope!==undefined){if(!scopes.includes(game.releaseScope))throw Error('遊戲開放範圍不正確。');return game.releaseScope;}return game.visible!==false&&game.status==='published'?'test':'off';}
function available(game,value='test'){return scope(game)!=='off'&&(target(value)==='test'||scope(game)==='production')&&game.visible!==false&&game.status==='published'&&!!game.url;}
const clone=value=>JSON.parse(JSON.stringify(value));
function project({games=[],scenes=[],settings={}},value='test'){
 const releaseTarget=target(value),copy=clone(settings),brand=copy.websiteBrand||(copy.websiteBrand={});brand.pages={...brand.pages};brand.controls={...brand.controls};
 const selected=games.filter(game=>available(game,releaseTarget)&&brand.pages[game.kind==='tool'?'tools':'games']!==false).map(game=>({...clone(game),releaseScope:scope(game)}));
 for(const kind of ['games','tools']){const enabled=brand.pages[kind]!==false&&selected.some(g=>(g.kind==='tool'?'tools':'games')===kind);brand.pages[kind]=enabled;if(!enabled)brand.controls[kind+'Navigation']=false;}
 const ids=new Set(selected.map(g=>g.id)),urls=new Set(selected.map(g=>g.url.replace(/index\.html$/,'').replace(/\/$/,'')));
 function allowedUrl(value){const clean=String(value||'').split(/[?#]/)[0].replace(/^https?:\/\/(?:www\.)?shi-gai\.com\//i,'').replace(/^\//,'').replace(/^(?:\.\.\/|\.\/)+/,'').replace(/^test\//,'').replace(/^website\//,'').replace(/index\.html$/,'').replace(/\/$/,'');if(clean==='games.html')return brand.pages.games;if(clean==='tools.html')return brand.pages.tools;if(/^(games|tools)\//.test(clean))return urls.has(clean);return true;}
 function sanitize(node){if(!node||typeof node!=='object')return;const i=node.interaction;if(i&&((i.action==='game'&&!ids.has(i.target))||(i.action==='url'&&!allowedUrl(i.target))||(i.action==='home-section'&&['dailyGame','daily-game'].includes(i.target)&&!brand.pages.games)))node.interaction={...i,enabled:false};for(const value of Object.values(node))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(sanitize):sanitize(value);}
 const sceneCopy=clone(scenes);sceneCopy.forEach(sanitize);sanitize(brand);copy.release={version:1,target:releaseTarget};
 return {games:selected,scenes:sceneCopy,settings:copy};
}
return Object.freeze({scopes,target,scope,available,project});
});
