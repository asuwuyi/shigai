// Optional, authored Scene events. No network, author writes or persistent visitor storage.
(function(global){
  'use strict';
  const clean=(v,n=120)=>String(v??'').trim().slice(0,n);
  const num=(v,min,max,f)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
  const clock=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))?String(v):'00:00';
  function normalize(items){
    const ids=new Set();return (Array.isArray(items)?items:[]).slice(0,100).map((v,i)=>{
      v=v&&typeof v==='object'?v:{};let id=clean(v.id)||'event-'+(i+1),suffix=0;while(ids.has(id))id='event-'+(i+1)+'-'+(++suffix);ids.add(id);
      if(clean(v.templateId))return {id,templateId:clean(v.templateId),objectId:clean(v.objectId),mediaObjectId:clean(v.mediaObjectId),enabled:v.enabled===true,...(v.clickPolicy==='original-first'?{clickPolicy:'original-first'}:{})};
      const lines=a=>(Array.isArray(a)?a:[]).slice(0,50).map(x=>clean(x,500)).filter(Boolean);
      return {...(v.pageLines!==undefined?{pageLines:Math.round(num(v.pageLines,1,6,3))}:{}),...(v.readingTime!==undefined?{readingTime:v.readingTime!==false}:{}),...(v.displayMode==='continuous'?{displayMode:'continuous',interval:num(v.interval,5,300,10)}:{}),...(v.clickPolicy==='original-first'?{clickPolicy:'original-first'}:{}),id,name:clean(v.name)||'新生活事件',enabled:v.enabled===true,objectId:clean(v.objectId),mediaObjectId:clean(v.mediaObjectId),trigger:['time','click','both'].includes(v.trigger)?v.trigger:'click',start:clock(v.start),end:clock(v.end),lines:lines(v.lines),replies:lines(v.replies),duration:num(v.duration,2,120,8),cooldown:num(v.cooldown,0,1440,60),dailyLimit:Math.round(num(v.dailyLimit,1,20,2)),priority:Math.round(num(v.priority,0,10,0))};
    });
  }
  function normalizeLibrary(items){
    const ids=new Set();return (Array.isArray(items)?items:[]).slice(0,500).filter(v=>v&&typeof v==='object').map((v,i)=>{const [event]=normalize([{...v,templateId:undefined,objectId:'',mediaObjectId:''}]);if(ids.has(event.id))throw Error('生活事件庫有重複ID。');ids.add(event.id);const {objectId,mediaObjectId,enabled,clickPolicy,...template}=event;return template;});
  }
  function resolveScene(scene,library=[]){
    const templates=new Map(normalizeLibrary(library).map(e=>[e.id,e]));
    const events=normalize(scene?.livingEvents).flatMap(binding=>{if(!binding.templateId)return [binding];const source=templates.get(binding.templateId);if(!source)return [];const {templateId,...local}=binding;return [{...source,...local}];});
    return {...scene,...(Array.isArray(scene?.livingEvents)?{livingEvents:events}:{})};
  }
  function localClock(scene,date=new Date()){
    const z=scene?.background?.weather?.timeZone;let options={year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'};
    if(z&&z!=='visitor')try{new Intl.DateTimeFormat('en',{timeZone:z});options.timeZone=z;}catch{}
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',options).formatToParts(date).map(x=>[x.type,x.value]));return {day:p.year+'-'+p.month+'-'+p.day,minute:Number(p.hour)*60+Number(p.minute)};
  }
  function inWindow(event,minute){const n=s=>Number(s.slice(0,2))*60+Number(s.slice(3)),a=n(event.start),b=n(event.end);return a===b|| (a<b?minute>=a&&minute<b:minute>=a||minute<b);}
  function eligible(event,scene,{now=new Date(),stats,click=false}={}){
    if(!event.enabled||!event.lines?.length||!scene?.objects?.some(o=>o.id===event.objectId&&o.visible!==false))return false;
    if(event.displayMode!=='continuous'&&(click?event.trigger==='time':event.trigger==='click'))return false;
    const time=localClock(scene,now);if((event.displayMode==='continuous'||event.trigger!=='click')&&!inWindow(event,time.minute))return false;
    if(stats?.dismissedDay===time.day)return false;
    // Visitor-initiated dialogue remains available after timeout; throttles govern automatic reminders.
    return event.displayMode==='continuous'||click||!(stats&&((stats.day===time.day&&stats.count>=event.dailyLimit)||now.getTime()-stats.last<event.cooldown*60000));
  }
  const history=new Map(),controllers=new Set();let major=null;
  function mount({container,scene,replace,preview=false,suppressAuto=false,canStart=()=>true,random=Math.random,now=()=>new Date()}){
    const events=normalize(scene.livingEvents);let current=null,timer=null,ended=false,observer;const abort=new AbortController(),session=preview?new Map():history;
    const paused=new Set();const key=e=>scene.id+':'+e.id;
    const sorted=events.slice().sort((a,b)=>b.priority-a.priority);
    function finish(){if(!current)return;const focused=current.controls.contains(container.ownerDocument.activeElement),actorId=current.event.objectId;clearTimeout(current.timer);current.restore();current.controls.remove();current=null;if(focused)Array.from(container.querySelectorAll('[data-scene-object-id]')).find(n=>n.dataset.sceneObjectId===actorId)?.focus({preventScroll:true});if(major===controller)major=null;}
    function scheduleDialogue(){
      if(!current)return;clearTimeout(current.timer);
      // A multi-page line waits for the visitor; never expire unread pages.
      if(current.restore.hasNextPage?.())return;
      const event=current.event,continuous=event.displayMode==='continuous';
      const seconds=Math.max(continuous&&!current.reply?event.interval:event.duration,current.restore.readingSeconds?.()||0);
      current.timer=setTimeout(()=>{if(ended||!current)return;if(continuous&&eligible(event,scene,{now:now(),stats:session.get(key(event))}))show(event,false,false);else finish();},seconds*1000);
    }
    function choose(lines,last){if(!lines.length)return '';let i=Math.floor(random()*lines.length)%lines.length;if(lines.length>1&&i===last)i=(i+1)%lines.length;return {text:lines[i],index:i};}
    function show(event,force=false,reply=false){
      if(ended||(!force&&!eligible(event,scene,{now:now(),stats:session.get(key(event)),click:reply})))return false;
      if(!preview&&major&&major!==controller)return false;
      const actor=scene.objects.find(o=>o.id===event.objectId&&o.visible!==false);if(!actor)return false;
      const last=session.get(key(event));const pick=choose(reply&&event.replies.length?event.replies:event.lines,last?.index);if(!pick)return false;
      finish();const restore=replace(actor,event,pick.text);if(!restore)return false;
      const controls=container.ownerDocument.createElement('div');controls.className='living-event-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label',event.name);
      for(const [label,action]of [['關閉',()=>{if(event.displayMode==='continuous')paused.add(event.id);finish();}],['今日不再提醒',()=>{const s=session.get(key(event))||{};session.set(key(event),{...s,dismissedDay:localClock(scene,now()).day});finish();}]]){const b=container.ownerDocument.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',e=>{e.stopPropagation();action();});controls.append(b);}
      container.append(controls);current={event,restore,controls,index:pick.index,reply,timer:null};if(!preview)major=controller;
      if(!force){const day=localClock(scene,now()).day;session.set(key(event),reply?{...last,last:now().getTime(),index:pick.index}:{day,count:(last?.day===day?last.count:0)+1,last:now().getTime(),index:pick.index,dismissedDay:last?.dismissedDay});if(session.size>500)session.delete(session.keys().next().value);}
      scheduleDialogue();container.dispatchEvent(new CustomEvent('living-event-start',{detail:{id:event.id}}));return true;
    }
    function click(e){if(e.target.closest('.living-event-controls'))return;const node=e.target.closest('[data-scene-object-id]');if(!node||!container.contains(node))return;const id=node.dataset.sceneObjectId;
      if(current?.event.objectId===id&&current.event.clickPolicy!=='original-first'){e.preventDefault();e.stopImmediatePropagation();if(current.restore.nextPage?.()){scheduleDialogue();return;}const event=current.event,pick=choose(event.replies.length?event.replies:event.lines,current.index);if(pick){current.restore();current.restore=replace(scene.objects.find(o=>o.id===id),event,pick.text);current.index=pick.index;current.reply=true;scheduleDialogue();}return;}
      // Ownership is stable while the authored event applies. Frequency limits
      // suppress dialogue, not silently switch a dialogue target into a link.
      const event=sorted.find(v=>v.objectId===id&&v.enabled&&v.lines.length&&(v.displayMode==='continuous'||v.trigger!=='time')&&((v.displayMode!=='continuous'&&v.trigger==='click')||inWindow(v,localClock(scene,now()).minute)));
      if(!event||event.clickPolicy==='original-first')return;
      e.preventDefault();e.stopImmediatePropagation();
      if(eligible(event,scene,{now:now(),stats:session.get(key(event)),click:true}))show(event,false,true);
    }
    function tick(){clearTimeout(timer);if(ended)return;if(!container.isConnected){destroy();return;}if(current?.event.displayMode==='continuous'&&!inWindow(current.event,localClock(scene,now()).minute))finish();if(!global.document.hidden&&canStart()&&!suppressAuto&&!current){const e=sorted.find(v=>!paused.has(v.id)&&eligible(v,scene,{now:now(),stats:session.get(key(v))}));if(e)show(e);}
      timer=setTimeout(tick,30000);
    }
    function destroy(){if(ended)return;ended=true;clearTimeout(timer);finish();abort.abort();observer?.disconnect();controllers.delete(controller);}
    const controller={destroy,finish,preview:id=>{const event=events.find(e=>e.id===id);return event?show(event,true,false):false;},get activeId(){return current?.event.id||'';}};
    container.addEventListener('click',click,{capture:true,signal:abort.signal});container.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-living-event-target]')){e.preventDefault();e.target.click();}},{signal:abort.signal});
    global.document.addEventListener('visibilitychange',()=>{if(global.document.hidden){clearTimeout(timer);finish();}else tick();},{signal:abort.signal});
    if(global.MutationObserver){observer=new MutationObserver(()=>{if(!container.isConnected)destroy();});observer.observe(global.document.documentElement,{childList:true,subtree:true});}
    for(const event of events.filter(e=>e.enabled&&(e.displayMode==='continuous'||e.trigger!=='time')&&e.clickPolicy!=='original-first')){const n=Array.from(container.querySelectorAll('[data-scene-object-id]')).find(n=>n.dataset.sceneObjectId===event.objectId);if(n){n.tabIndex=0;n.setAttribute('role','button');n.setAttribute('data-living-event-target','');n.setAttribute('aria-label',(n.getAttribute('aria-label')||event.name)+'：點擊對話');n.style.cursor='pointer';}}
    controllers.add(controller);if(!suppressAuto)tick();return controller;
  }
  const api={normalize,normalizeLibrary,resolveScene,localClock,inWindow,eligible,mount};global.ShiGaiLivingEvents=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
