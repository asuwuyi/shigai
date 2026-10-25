(function expose(global) {
  'use strict';
  const text=(v,n=120)=>typeof v==='string'?v.trim().slice(0,n):'';
  const number=(v,min,max,f)=>v!=null&&v!==''&&Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
  const list=(v,pattern)=>[...new Set((Array.isArray(v)?v:typeof v==='string'?v.split(/[,，\s]+/):[]).map(x=>text(x)).filter(x=>pattern.test(x)))].slice(0,366);
  const weatherTypes=['any','clear','cloudy','overcast','fog','rain','snow','storm'];
  const periods=[['dawn','清晨'],['morning','早上'],['noon','中午'],['afternoon','下午'],['dusk','黃昏'],['night','晚上']];
  const periodKeys=[...periods.map(v=>v[0]),'day'];
  const weatherLabels=[['clear','晴天'],['cloudy','多雲'],['overcast','陰天'],['rain','雨天'],['fog','霧'],['storm','雷雨'],['snow','雪']];
  const choices=(values,allowed)=>allowed.filter(v=>Array.isArray(values)&&values.includes(v));
  const normalizeClassification=value=>({periods:choices(value?.periods,periodKeys),weathers:choices(value?.weathers,weatherTypes.slice(1)),...(value?.periodVersion===2?{periodVersion:2}:{})});
  function displayPeriods(value){const source=value?.periods||[];if(value?.periodVersion===2)return source;return [...new Set(source.flatMap(p=>p==='day'?['morning','noon','afternoon']:p==='morning'?['dawn','morning']:[p]))];}
  function zone(v){if(!v||v==='visitor')return 'visitor';try{new Intl.DateTimeFormat('en',{timeZone:v}).format();return text(v,80)}catch{return 'visitor'}}
  const clock=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:'';
  const asset=v=>{const p=text(v,500).replaceAll('\\','/');return p.startsWith('assets/')&&!p.split('/').includes('..')&&!/[?#\x00-\x1f]/.test(p)?p:''};
  const color=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v.toUpperCase():'#F7F9FC';
  function normalizeProcedural(value){if(!value||!['rain','fog','lightning'].includes(value.type))return null;return {type:value.type,intensity:number(value.intensity,0,1,.55),speed:number(value.speed,.2,2,1),wind:number(value.wind,-1,1,.2)};}
  function normalizeCondition(value){
    const s=value&&typeof value==='object'?value:{};
    const legacy=/^(\d\d:\d\d)\s*[-–]\s*(\d\d:\d\d)$/.exec(s.time||'');
    return {mode:['environment','fixed','random','weight','time','date','holiday','event','custom'].includes(s.mode)?s.mode:'fixed',timezone:zone(s.timezone),start:clock(s.start)||clock(legacy?.[1]||''),end:clock(s.end)||clock(legacy?.[2]||''),time:text(s.time,80),dates:list(s.dates,/^\d{4}-\d{2}-\d{2}$/),holidays:list(s.holidays,/^\d{2}-\d{2}$/),weekdays:[...new Set((Array.isArray(s.weekdays)?s.weekdays:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))],weather:weatherTypes.includes(s.weather)?s.weather:'any',weight:number(s.weight,0,100,1),random:s.random===true,event:text(s.event),fallback:s.fallback===true,...(s.mode==='environment'?{periods:choices(s.periods,periodKeys),...(s.periodVersion===2?{periodVersion:2}:{}),weathers:choices(s.weathers,weatherTypes.slice(1)),...(s.followWeather===true?{followWeather:true}:{})}:{})};
  }
  function normalizeWeather(value){const s=value||{};let url='';if(typeof s.url==='string'&&/^\/(?!\/)/.test(s.url)&&!s.url.includes('..')&&!s.url.includes('?'))url=text(s.url,500);try{const u=new URL(s.url);if(u.protocol==='https:'&&!u.username&&!u.password&&!/[?&](?:key|token|apikey|api_key)=/i.test(u.href))url=u.href}catch{}
    return {provider:['none','open-meteo','custom'].includes(s.provider)?s.provider:'none',city:text(s.city),latitude:number(s.latitude,-90,90,null),longitude:number(s.longitude,-180,180,null),...(s.timeZone?{timeZone:zone(s.timeZone)}:{}),url,attribution:text(s.attribution,120)||(s.provider==='custom'?'天氣資料':'Weather data by Open-Meteo')};
  }
  // NOAA general solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  // Local calculation only; approximate apparent sunrise/sunset, not a weather forecast.
  function solarPeriod(config,now=new Date()){
    const s=normalizeWeather(config),d=new Date(now),ms=d.getTime();
    if(!Number.isFinite(ms))return {period:'night',phase:'night',source:'unavailable',sunrise:null,sunset:null};
    if(s.latitude===null||s.longitude===null){const minutes=localTime(d,s.timeZone||'visitor').minutes;return {period:minutes<360||minutes>=1140?'night':minutes<540?'morning':minutes<1020?'day':'dusk',phase:minutes<330||minutes>=1140?'night':minutes<390?'dawn':minutes<660?'morning':minutes<780?'noon':minutes<1020?'afternoon':'dusk',source:'clock-fallback',sunrise:null,sunset:null};}
    // Solar date follows longitude, not political UTC offsets across the date line.
    const key=new Date(ms+s.longitude*240000).toISOString().slice(0,10);
    const midnight=Date.parse(key+'T00:00:00Z'),year=Number(key.slice(0,4)),day=Math.round((midnight-Date.UTC(year,0,1))/86400000)+1,days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    const g=2*Math.PI/days*(day-1),eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
    const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g),rad=Math.PI/180,lat=s.latitude*rad;
    const cosine=(Math.cos(90.833*rad)-Math.sin(lat)*Math.sin(decl))/(Math.cos(lat)*Math.cos(decl));
    if(cosine>1||cosine< -1)return {period:cosine>1?'night':'day',phase:cosine>1?'night':'noon',source:'solar',sunrise:null,sunset:null};
    const angle=Math.acos(Math.max(-1,Math.min(1,cosine)))/rad,noon=720-4*s.longitude-eq,sunrise=midnight+(noon-4*angle)*60000,sunset=midnight+(noon+4*angle)*60000;
    // Short artistic dawn/dusk windows track the sun rather than fixed clock inputs.
    const morningEnd=Math.min(sunrise+120*60000,(sunrise+sunset)/2),duskStart=Math.max(sunset-60*60000,morningEnd);
    const period=ms<sunrise-30*60000||ms>=sunset+30*60000?'night':ms<morningEnd?'morning':ms<duskStart?'day':'dusk';
    const mid=(sunrise+sunset)/2,span=sunset-sunrise,dawnEnd=sunrise+Math.min(30*60000,span/8),noonStart=Math.max(dawnEnd,mid-Math.min(60*60000,span/8)),noonEnd=mid+Math.min(60*60000,span/8),dusk=Math.max(noonEnd,sunset-Math.min(60*60000,span/8));
    const phase=ms<sunrise-30*60000||ms>=sunset+30*60000?'night':ms<dawnEnd?'dawn':ms<noonStart?'morning':ms<noonEnd?'noon':ms<dusk?'afternoon':'dusk';
    return {period,phase,source:'solar',sunrise,sunset};
  }
  function environmentContext(background,context={}){const solar=solarPeriod(background?.weather,context.now),phase=context.phase||solar.phase;return {...context,phase,period:context.period||(context.phase?(['dawn','morning'].includes(phase)?'morning':['noon','afternoon'].includes(phase)?'day':phase):solar.period)};}
  function normalizeBackground(value){const s=value||{},seen=new Set();const result={color:color(s.color),asset:asset(s.asset),automatic:s.automatic===true,intervalMinutes:Math.round(number(s.intervalMinutes,1,1440,30)),weather:normalizeWeather(s.weather),variants:(Array.isArray(s.variants)?s.variants:[]).filter(v=>v&&typeof v==='object').slice(0,60).map((v,i)=>{let id=/^[a-zA-Z0-9_-]{1,100}$/.test(v.id||'')?v.id:'background-'+(i+1);while(seen.has(id))id+='-copy';seen.add(id);return{id,name:text(v.name)||'背景 '+(i+1),enabled:v.enabled!==false,color:color(v.color),asset:asset(v.asset),...(v.assetId?{assetId:text(v.assetId,100)}:{}),condition:normalizeCondition(v.condition)}})};
    if(Array.isArray(s.effects))result.effects=s.effects.filter(v=>v&&typeof v==='object').slice(0,60).map((v,i)=>({id:/^[a-zA-Z0-9_-]{1,100}$/.test(v.id||'')?v.id:'effect-'+i,name:text(v.name)||'環境效果',enabled:v.enabled!==false,asset:asset(v.asset),...(v.assetId?{assetId:text(v.assetId,100)}:{}),...(normalizeProcedural(v.procedural)?{procedural:normalizeProcedural(v.procedural)}:{}),layer:v.layer==='back'?'back':'front',group:text(v.group,80),opacity:number(v.opacity,0,1,1),condition:normalizeCondition(v.condition)})).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i);
    return result;
  }
  function resolveEffects(background,context={},random=.5){context=environmentContext(background,context);const items=(normalizeBackground(background).effects||[]).filter(v=>v.enabled&&(v.asset||v.procedural)&&v.condition.weight>0&&(!v.condition.followWeather||v.condition.weathers.includes(context.weather))),groups=new Map();for(const item of items){if(!groups.has(item.group))groups.set(item.group,[]);groups.get(item.group).push(item);}const result=[];for(const [name,group]of groups){const eligible=group.filter(v=>!v.condition.fallback&&matches(v.condition,context)),candidates=eligible.length?eligible:group.filter(v=>v.condition.fallback);if(!name)result.push(...candidates);else{const chosen=pick(candidates,random);if(chosen)result.push(chosen);}}return result;}
  const effectMounts=new WeakMap();
  function renderEffects({container,background,context={},random=.5,resolveAsset=value=>value,frontContainer=container,backContainer=container,respectMotion=true}){
    if(!container)return;const reduced=respectMotion&&global.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const chosen=reduced?[]:resolveEffects(background,context,random),signature=JSON.stringify(chosen.map(v=>[v.id,v.asset,v.layer,v.opacity,v.procedural]));
    const previous=effectMounts.get(container);if(previous?.signature===signature&&previous.front===frontContainer&&previous.back===backContainer&&previous.nodes.every(n=>n.isConnected))return;
    previous?.nodes.forEach(n=>{n.weatherStop?.();n.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});n.remove();});const nodes=[];
    if(chosen.length)for(const parent of new Set([container,frontContainer,backContainer])){const plane=parent?.querySelector(':scope > .scene-render-plane');if(plane)plane.style.zIndex='2';}
    for(const item of chosen){const host=global.document.createElement('div');host.dataset.environmentEffect=item.id;host.setAttribute('aria-hidden','true');host.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:'+(item.layer==='back'?1:9999)+';opacity:'+item.opacity;
      if(item.procedural){
        const parent=item.layer==='back'?backContainer:frontContainer;
        const plane=item.layer==='back'&&parent?.querySelector(':scope > .scene-render-plane');
        if(plane){
          // "Behind characters" must still be above opaque background Objects.
          // Stay inside the same stacking context without changing any Object z-index.
          const objects=[...plane.children].filter(n=>n.classList.contains('scene-render-object'));
          const foreground=objects.filter(n=>!n.classList.contains('is-background')).sort((a,b)=>Number(a.style.zIndex)-Number(b.style.zIndex));
          const first=foreground[0];host.style.zIndex=String(first?Number(first.style.zIndex)||1:Math.max(0,...objects.map(n=>Number(n.style.zIndex)||0))+1);
          host.dataset.environmentPlacement='above-background-below-objects';plane.insertBefore(host,first||null);
        }else parent?.append(host);
        host.weatherStop=global.ShiGaiWeatherEffects?.mount(host,item.procedural);nodes.push(host);continue;
      }
      const media=global.document.createElement(/\.(webm|mp4)$/i.test(item.asset)?'video':'img');if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.autoplay=true;media.playsInline=true;}else media.alt='';media.src=resolveAsset(item.asset);media.style.cssText='width:100%;height:100%;object-fit:cover;pointer-events:none';host.append(media);(item.layer==='back'?backContainer:frontContainer)?.append(host);nodes.push(host);
    }effectMounts.set(container,{signature,nodes,front:frontContainer,back:backContainer});
  }
  function localTime(date,timeZone){const d=date instanceof Date?date:new Date(date??Date.now());const tz=zone(timeZone);if(tz==='visitor'){return {date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),minutes:d.getHours()*60+d.getMinutes(),weekday:d.getDay()}}const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));const key=p.year+'-'+p.month+'-'+p.day;return {date:key,minutes:Number(p.hour)*60+Number(p.minute),weekday:new Date(key+'T12:00:00Z').getUTCDay()};}
  function matches(value,context={}){const c=normalizeCondition(value);if(c.weight<=0)return false;if(['fixed','random','weight'].includes(c.mode))return true;
    if(c.mode==='environment')return (!c.periods.length||c.periods.includes(c.periodVersion===2?(context.phase||context.period):context.period))&&(!c.weathers.length?!c.followWeather:context.weather==='style-random'?!c.followWeather:c.weathers.includes(context.weather));
    const t=localTime(context.now,c.timezone==='visitor'?(context.visitorTimeZone||'visitor'):c.timezone),minute=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
    if(['time','custom'].includes(c.mode)){if(c.mode==='time'&&(!c.start||!c.end))return false;if(c.start&&c.end){const a=minute(c.start),b=minute(c.end);if(a!==b&&!(a<b?t.minutes>=a&&t.minutes<b:t.minutes>=a||t.minutes<b))return false}}
    if((c.mode==='date'||c.mode==='custom'&&c.dates.length)&&!c.dates.includes(t.date))return false;
    if((c.mode==='holiday'||c.mode==='custom'&&c.holidays.length)&&!c.holidays.includes(t.date.slice(5)))return false;
    if(c.weekdays.length&&!c.weekdays.includes(t.weekday))return false;
    if(c.weather!=='any'&&context.weather!=='style-random'&&c.weather!==context.weather&&!(c.weather==='cloudy'&&context.weather==='overcast'))return false;
    if((c.mode==='event'||c.mode==='custom'&&c.event)&&!context.events?.includes(c.event))return false;
    return true;
  }
  function pick(items,random=Math.random()){const total=items.reduce((a,v)=>a+normalizeCondition(v.condition).weight,0);if(!total)return null;let n=Math.max(0,Math.min(.999999999,Number(random)||0))*total;return items.find(v=>(n-=normalizeCondition(v.condition).weight)<0)||items.at(-1);}
  function selectScene(scenes,context={},random=Math.random()){const items=(scenes||[]).filter(s=>s.status==='published'&&s.type==='world-entrance').sort((a,b)=>Number(a.order||0)-Number(b.order||0));const eligible=items.filter(s=>!s.condition?.fallback&&matches(s.condition,{...context,weather:context.weatherByScene?.[s.id]??context.weather}));return pick(eligible,random)||pick(items.filter(s=>s.condition?.fallback&&normalizeCondition(s.condition).weight>0),random);}
  function resolveBackground(background,context={},random=Math.random()){context=environmentContext(background,context);const b=normalizeBackground(background);if(!b.automatic)return {...b,variantId:''};const all=b.variants.filter(v=>v.enabled&&!v.condition.fallback&&matches(v.condition,context));const conditional=all.filter(v=>{const c=v.condition;if(c.mode==='environment')return Boolean(c.periods.length||c.weathers.length);if(['fixed','random','weight'].includes(c.mode))return false;return c.mode!=='custom'||Boolean(c.start&&c.end||c.dates.length||c.holidays.length||c.weekdays.length||c.weather!=='any'||c.event)});const chosen=pick(conditional.length?conditional:all,random)||pick(b.variants.filter(v=>v.enabled&&v.condition.fallback),random);return chosen?{...b,color:chosen.color,asset:chosen.asset,variantId:chosen.id,variantName:chosen.name}:{...b,variantId:'',variantName:'預設備用背景'};}
  function weatherCode(code){if(code==null)return null;const c=Number(code);return c===0?'clear':c===3?'overcast':[1,2].includes(c)?'cloudy':[45,48].includes(c)?'fog':[95,96,99].includes(c)?'storm':[71,73,75,77,85,86].includes(c)?'snow':[51,53,55,56,57,61,63,65,66,67,80,81,82].includes(c)?'rain':null;}
  const cache=new Map(),inflight=new Map();
  async function readWeather(config,{fetcher=global.fetch,now=Date.now()}={}){const s=normalizeWeather(config);if(s.provider==='none'||typeof fetcher!=='function')return null;let url=s.url;if(s.provider==='open-meteo'){if(s.latitude===null||s.longitude===null)return null;url='https://api.open-meteo.com/v1/forecast?latitude='+s.latitude+'&longitude='+s.longitude+'&current=weather_code&timezone=auto'}if(!url)return null;if(s.provider==='custom'&&global.location&&new URL(url,global.location.href).origin!==global.location.origin)return null;const cached=cache.get(url);if(cached&&now-cached.at<15*60*1000)return cached.value;if(inflight.has(url))return inflight.get(url);
    const request=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);try{const response=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('weather');const data=await response.json();const value=weatherTypes.slice(1).includes(data.weather)?data.weather:weatherCode(data.current?.weather_code);cache.set(url,{at:now,value});return value}catch{cache.set(url,{at:now,value:null});return null}finally{clearTimeout(timer)}})();inflight.set(url,request);request.finally(()=>inflight.delete(url));return request;}

  const mountedBackgrounds=new WeakMap(),backgroundDraws=new Map();
  function bindBackground({container,scene,resolveAsset=value=>value,frontContainer=container,backContainer=container}) {
    if(!container)return()=>{};mountedBackgrounds.get(container)?.();
    const settings=normalizeBackground(scene?.background);if(!settings.automatic&&!settings.effects?.length)return()=>{};
    let stopped=false,weather=settings.weather.provider==='none'?'style-random':null,attribution=null;
    function update(){if(stopped||!container.isConnected)return;const bucket=Math.floor(Date.now()/(settings.intervalMinutes*60000)),previous=backgroundDraws.get(scene.id);if(!previous||previous.bucket!==bucket)backgroundDraws.set(scene.id,{bucket,value:Math.random()});const context={now:new Date(),weather,events:[new URLSearchParams(global.location?.search||'').get('sceneEvent')].filter(Boolean)},random=backgroundDraws.get(scene.id).value,background=resolveBackground(settings,context,random);if(settings.automatic){container.style.backgroundColor=background.color;container.style.backgroundImage=background.asset?'url("'+resolveAsset(background.asset)+'")':'none';container.style.backgroundSize='cover';container.style.backgroundPosition='center';container.dataset.backgroundVariant=background.variantId||'base';}renderEffects({container,background:settings,context,random,resolveAsset,frontContainer,backContainer});}
    async function refresh(){if(stopped||global.document.hidden)return;if(!container.isConnected){stop();return;}weather=settings.weather.provider==='none'?'style-random':await readWeather(settings.weather);update();}
    const timer=setInterval(refresh,60000);
    function stop(){stopped=true;clearInterval(timer);attribution?.remove();renderEffects({container,background:{effects:[]},resolveAsset,frontContainer,backContainer});}
    mountedBackgrounds.set(container,stop);update();refresh();
    if(settings.weather.provider!=='none'){attribution=global.document.createElement(settings.weather.provider==='open-meteo'?'a':'span');attribution.textContent=settings.weather.attribution;attribution.style.cssText='position:absolute;left:12px;bottom:12px;font-size:12px;z-index:6;background:#fffdf5cc;color:#34271f;padding:3px 8px;border-radius:8px';if(settings.weather.provider==='open-meteo'){attribution.href='https://open-meteo.com/';attribution.target='_blank';attribution.rel='noopener';}container.append(attribution);}
    return stop;
  }

  const api=Object.freeze({displayPeriods,normalizeClassification,periods,weatherLabels,solarPeriod,environmentContext,normalizeProcedural,bindBackground,renderEffects,resolveEffects,normalizeCondition,normalizeBackground,normalizeWeather,localTime,matches,pick,selectScene,resolveBackground,weatherCode,readWeather});if(global)global.ShiGaiSceneEnvironment=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
