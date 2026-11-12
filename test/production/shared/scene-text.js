// Optional local clock/date and authored announcements; one runtime for Studio and Website.
(function(global){
  'use strict';
  const rules=()=>global.ShiGaiSceneRender||(typeof require==='function'?require('./scene-render-rules.js'):null);
  const records=new Set(),formatters=new Map();let timer=null,observer=null,intersection=null,resize=null,installed=false;
  const motion=()=>global.matchMedia?.('(prefers-reduced-motion: reduce)');
  function formatText(object,scene,now=new Date()){
    const settings=rules().normalizeTextDisplay(object?.textDisplay);
    if(settings.source==='manual')return String(object?.text||'');
    let timeZone=settings.timeZone==='scene'?scene?.background?.weather?.timeZone:settings.timeZone==='visitor'?undefined:settings.timeZone;
    try{if(timeZone&&timeZone!=='visitor')new Intl.DateTimeFormat('en',{timeZone});else timeZone=undefined;}catch{timeZone=undefined;}
    const options={...(timeZone?{timeZone}:{}),...(settings.source!=='time'?{year:'numeric',month:'2-digit',day:'2-digit',...(settings.weekday?{weekday:'short'}:{})}:{}),...(settings.source!=='date'?{hour:'2-digit',minute:'2-digit',...(settings.showSeconds?{second:'2-digit'}:{}),...(settings.hour12?{hour12:true}:{hourCycle:'h23'})}:{})};
    const key=JSON.stringify(options);if(!formatters.has(key)){if(formatters.size>=64)formatters.delete(formatters.keys().next().value);formatters.set(key,new Intl.DateTimeFormat('zh-TW',options));}
    return formatters.get(key).format(now);
  }
  function clean(record){
    if(!records.delete(record))return;record.animation?.cancel();clearTimeout(record.hold);record.abort.abort();intersection?.unobserve(record.node);resize?.unobserve(record.node);
  }
  function prune(){for(const r of records)if(!r.node.isConnected)clean(r);if(!records.size&&timer!==null){clearTimeout(timer);timer=null;}}
  function schedule(){
    if(timer!==null){clearTimeout(timer);timer=null;}prune();
    const clocks=[...records].filter(r=>r.settings.source!=='manual');
    if(!clocks.length||global.document.hidden)return;
    const period=clocks.some(r=>r.settings.source!=='date'&&r.settings.showSeconds)?1000:60000;
    timer=setTimeout(()=>{timer=null;for(const r of records)if(r.visible&&r.settings.source!=='manual')r.update();schedule();},period-Date.now()%period+15);
  }
  function install(){
    if(installed)return;installed=true;
    if(global.MutationObserver){observer=new global.MutationObserver(prune);observer.observe(global.document.documentElement,{childList:true,subtree:true});}
    if(global.IntersectionObserver)intersection=new global.IntersectionObserver(entries=>{for(const e of entries)for(const r of records)if(r.node===e.target){r.visible=e.isIntersecting;if(r.visible)r.update();r.pause();}});
    if(global.ResizeObserver)resize=new global.ResizeObserver(entries=>{for(const e of entries)for(const r of records)if(r.node===e.target)r.reflow();});
    global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden)for(const r of records)r.update();for(const r of records)r.pause();schedule();});
    motion()?.addEventListener?.('change',()=>{for(const r of records)r.reflow();});
    global.addEventListener?.('pagehide',()=>{if(timer!==null)clearTimeout(timer);timer=null;for(const r of records)r.animation?.pause();});
    global.addEventListener?.('pageshow',()=>{for(const r of records){r.update();r.pause();}schedule();});
    global.document.fonts?.ready.then(()=>{for(const r of records)r.reflow();});
  }
  function mount({node,wrapper,object,scene,layout='landscape',editorSelectable=false}){
    install();const settings=rules().normalizeTextDisplay(object.textDisplay),bubble=rules().normalizeTextBubble(object.textBubble),placement=bubble.layouts[layout];
    node.classList.add('scene-info-text');node.dataset.textSource=settings.source;node.dataset.textMode=settings.mode;
    Object.assign(node.style,{width:placement.maxWidth+'px',maxWidth:'none',fontSize:placement.fontSize+'px',fontWeight:String(bubble.fontWeight),fontFamily:rules().fontFamily(bubble.fontFamily),color:bubble.color});node.style.setProperty('--info-lines',settings.lines);
    const content=node.ownerDocument.createElement('span');content.className='scene-info-content';node.replaceChildren(content);
    const abort=new AbortController(),record={node,wrapper,object,settings,abort,visible:true,hover:false,userPaused:false,animation:null,text:null,hold:null,suppressUntil:0};
    record.pause=()=>{if(!record.animation)return;if(record.userPaused||record.hover||!record.visible||global.document.hidden)record.animation.pause();else record.animation.play();node.dataset.marqueePaused=String(record.userPaused||record.hover);};
    record.reflow=()=>{
      record.animation?.cancel();record.animation=null;content.replaceChildren();
      if(settings.mode!=='marquee'){content.textContent=record.text;return;}
      const track=node.ownerDocument.createElement('span');track.className='scene-info-track';const item=node.ownerDocument.createElement('span');item.className='scene-info-item';item.textContent=String(record.text||'').replace(/\s*\n\s*/g,'　•　');item.style.paddingInlineEnd=settings.gap+'px';track.append(item);content.append(track);
      if(editorSelectable||motion()?.matches||!node.isConnected||item.offsetWidth-settings.gap<=content.clientWidth+1)return;
      const duplicate=item.cloneNode(true);duplicate.setAttribute('aria-hidden','true');track.append(duplicate);
      const distance=item.offsetWidth,from=settings.direction==='left'?0:-distance,to=settings.direction==='left'?-distance:0;
      record.animation=track.animate([{transform:'translateX('+from+'px)'},{transform:'translateX('+to+'px)'}],{duration:distance/settings.speed*1000,iterations:Infinity,easing:'linear'});record.pause();
    };
    record.update=()=>{const value=formatText(object,scene);if(value!==record.text){record.text=value;node.setAttribute('aria-label',value);node.title=value;record.reflow();}};
    if(settings.mode==='marquee'&&!editorSelectable){
      const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:abort.signal});
      node.tabIndex=wrapper.tabIndex>=0?-1:0;node.setAttribute('role','group');node.setAttribute('aria-roledescription','跑馬燈');node.setAttribute('aria-keyshortcuts','Space');node.style.userSelect='none';
      on(node,'pointerenter',e=>{if(!e.pointerType||e.pointerType==='mouse'){record.hover=true;record.pause();}});on(node,'pointerleave',()=>{record.hover=false;record.pause();clearTimeout(record.hold);});
      let start=null;
      on(node,'pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};clearTimeout(record.hold);record.hold=setTimeout(()=>{record.userPaused=!record.userPaused;record.suppressUntil=performance.now()+800;record.pause();},500);});
      on(node,'pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>8){clearTimeout(record.hold);start=null;}});
      for(const event of ['pointerup','pointercancel'])on(node,event,()=>{clearTimeout(record.hold);start=null;});
      on(wrapper,'click',e=>{if(performance.now()<record.suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
      on(node,'contextmenu',e=>e.preventDefault());
      on(wrapper,'keydown',e=>{if(e.key===' '&&(node.contains(e.target)||e.target===wrapper)){e.preventDefault();e.stopImmediatePropagation();record.userPaused=!record.userPaused;record.pause();}},{capture:true});
    }
    records.add(record);record.update();queueMicrotask(()=>{if(node.isConnected){record.reflow();intersection?.observe(node);resize?.observe(node);schedule();}else{clean(record);}});
    return()=>{clean(record);schedule();};
  }
  const api=Object.freeze({formatText,mount});if(global)global.ShiGaiSceneText=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
