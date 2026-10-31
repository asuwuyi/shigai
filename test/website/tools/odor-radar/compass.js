/* Heading is transient: no location request, storage or upload. */
(function(root){
'use strict';
const normalize=n=>((n%360)+360)%360;
function heading(event,screenAngle=0){
 if(typeof event.webkitCompassHeading==='number'&&Number.isFinite(event.webkitCompassHeading)){
  if(typeof event.webkitCompassAccuracy==='number'&&(event.webkitCompassAccuracy<0||event.webkitCompassAccuracy>50))return null;
  return normalize(event.webkitCompassHeading+screenAngle);
 }
 if(event.absolute===true&&typeof event.alpha==='number'&&Number.isFinite(event.alpha))return normalize(360-event.alpha+screenAngle);
 return null;
}
function attach(map){
 const doc=root.document,button=doc.getElementById('followHeading'),reset=doc.getElementById('resetNorth'),status=doc.getElementById('compassStatus'),needle=doc.getElementById('northNeedle');
 if(!map.setHeading||!map.setBearing){status.textContent='地圖旋轉元件未載入，維持北方朝上。';return;}
 let active=false,pending=false,generation=0,watchdog=null,last=0;
 const say=t=>status.textContent=t;
 function remove(){root.removeEventListener('deviceorientation',receive);root.removeEventListener('deviceorientationabsolute',receive);clearInterval(watchdog);watchdog=null;}
 function stop(message='北方朝上。可再次開啟跟隨手機方向。'){
  generation++;active=false;pending=false;remove();map.stopHeadingUp();map.setBearing(0);button.disabled=false;button.setAttribute('aria-pressed','false');button.textContent='跟隨手機方向';say(message);
 }
 function receive(e){if(!active||doc.hidden)return;const angle=root.screen?.orientation?.angle??root.orientation??0,h=heading(e,angle);if(h===null)return;last=Date.now();map.setHeading(h,{ease:.15,deadzone:1});say(`跟隨手機方向 · 朝向 ${Math.round(h)}°。請接近平放；羅盤可能受金屬或磁場影響。`);}
 async function start(){
  if(active||pending){stop();return;}
  if(!root.isSecureContext){say('羅盤需要安全連線，請以 HTTPS 開啟網站。');return;}
  const Sensor=root.DeviceOrientationEvent;if(!Sensor){say('此裝置或瀏覽器不提供羅盤，維持北方朝上。');return;}
  pending=true;const token=++generation;button.disabled=true;say('正在啟用羅盤；若手機詢問，請允許動作與方向感測。');
  try{
   if(typeof Sensor.requestPermission==='function'){const permission=await Sensor.requestPermission(true);if(token!==generation)return;if(permission!=='granted'){stop('尚未允許方向感測，維持北方朝上。可調整瀏覽器權限後重試。');return;}}
   if(token!==generation||doc.hidden){stop();return;}
   pending=false;active=true;last=Date.now();button.disabled=false;button.setAttribute('aria-pressed','true');button.textContent='停止跟隨方向';say('等待羅盤訊號…請將手機接近平放並輕轉方向。');
   root.addEventListener('deviceorientation',receive);root.addEventListener('deviceorientationabsolute',receive);
   watchdog=setInterval(()=>{if(Date.now()-last>10000)stop('未收到可靠羅盤訊號，已回到北方朝上。請確認感測權限並接近平放後重試。');},1000);
  }catch(e){if(token===generation)stop('羅盤無法啟用，維持北方朝上。請確認瀏覽器的方向感測權限。');}
 }
 button.disabled=false;reset.disabled=false;button.onclick=start;reset.onclick=()=>stop();
 map.on('rotate',()=>{needle.style.transform=`rotate(${map.getBearing()}deg)`;});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&(active||pending))stop('已暫停羅盤並回到北方朝上。回到頁面後可重新開啟。');});
 root.addEventListener('pagehide',()=>stop());map.on('unload',()=>{generation++;active=false;remove();});
}
const api={heading,normalize,attach};if(typeof module==='object'&&module.exports)module.exports=api;else root.OdorCompass=api;
})(typeof window==='undefined'?globalThis:window);
