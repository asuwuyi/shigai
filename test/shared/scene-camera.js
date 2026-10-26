(function(global){
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  // Automatic environment variants are the distant sky; fixed Background Asset
  // belongs to the same set as the characters. Never infer a role from filenames.
  function backgroundRole(background){return background?.automatic===true?'weather':'stage';}
  function backgroundFrame({enabled,role='weather',viewportWidth,viewportHeight,surfaceWidth,surfaceHeight,offset=0,maxOffset=0,parallax=true}={}){
    if(!enabled)return null;
    const width=Math.max(1,finite(viewportWidth,1)),height=Math.max(1,finite(viewportHeight,1));
    const extent=Math.max(0,finite(maxOffset)),position=clamp(finite(offset),-extent,extent);
    if(role==='stage')return {role,width:Math.max(width,finite(surfaceWidth,width)),height:Math.max(height,finite(surfaceHeight,height)),x:position};
    const overscan=parallax?Math.min(32,width*.08):0;
    return {role:'weather',width:width+overscan*2,height,x:extent&&parallax?-position/extent*overscan:0};
  }
  const owned=['position','inset','left','top','width','height','transform','translate','scale','transition','pointer-events'];
  const mounted=new WeakMap();
  function applyBackdrop(element,frame){
    if(!element)return;
    let previous=mounted.get(element);
    if(!frame){
      if(!previous)return;
      for(const [name,value,priority]of previous.styles){if(value)element.style.setProperty(name,value,priority);else element.style.removeProperty(name);}
      if(previous.attribute===null)element.removeAttribute('data-scene-camera-backdrop');else element.setAttribute('data-scene-camera-backdrop',previous.attribute);
      mounted.delete(element);return;
    }
    if(!previous){previous={styles:owned.map(name=>[name,element.style.getPropertyValue(name),element.style.getPropertyPriority(name)]),attribute:element.getAttribute('data-scene-camera-backdrop')};mounted.set(element,previous);}
    const geometry=[frame.role,frame.width,frame.height].join(':');
    if(previous.geometry!==geometry){
      element.dataset.sceneCameraBackdrop=frame.role;
      Object.assign(element.style,{position:'absolute',inset:'auto',left:'50%',top:'50%',width:frame.width+'px',height:frame.height+'px',translate:'none',scale:'1',transition:'none',pointerEvents:'none'});
      previous.geometry=geometry;
    }
    if(previous.x!==frame.x){element.style.transform='translate(-50%, -50%) translateX('+frame.x.toFixed(2)+'px)';previous.x=frame.x;}
  }
  const api=Object.freeze({backgroundRole,backgroundFrame,applyBackdrop});
  if(global)global.ShiGaiSceneCamera=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
