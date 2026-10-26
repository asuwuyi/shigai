(function(global){
  'use strict';
  const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  // Automatic environment variants are the distant sky; fixed Background Asset
  // belongs to the same set as the characters. Never infer a role from filenames.
  function backgroundRole(background){return background?.automatic===true?'weather':'stage';}
  function backgroundFrame({enabled,role='weather',viewportWidth,viewportHeight,surfaceWidth,surfaceHeight,offset=0,maxOffset=0,minOffset=-maxOffset,parallax=true}={}){
    if(!enabled)return null;
    const width=Math.max(1,finite(viewportWidth,1)),height=Math.max(1,finite(viewportHeight,1));
    const extent=Math.max(0,finite(maxOffset)),minimum=Math.min(0,finite(minOffset,-extent)),position=clamp(finite(offset),minimum,extent);
    if(role==='stage')return {role,width:Math.max(width,finite(surfaceWidth,width)),height:Math.max(height,finite(surfaceHeight,height)),x:position};
    const overscan=parallax?Math.min(32,width*.08):0;
    return {role:'weather',width:width+overscan*2,height,x:parallax?(position<0&&minimum?position/minimum*overscan:extent?-position/extent*overscan:0):0};
  }
  // Bounds use actual background media, not zero-size Object anchors or foreground actors.
  const imageSizes=new Map();
  function imageSize(url){
    if(!url||typeof global.Image!=='function')return Promise.resolve(null);
    if(!imageSizes.has(url))imageSizes.set(url,new Promise(resolve=>{const image=new global.Image();image.onload=()=>resolve({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>{imageSizes.delete(url);resolve(null);};image.src=url;}));
    return imageSizes.get(url);
  }
  function panRange(viewportWidth,surfaceWidth,bounds=[]){
    const viewport=Math.max(1,finite(viewportWidth,1)),surface=Math.max(viewport,finite(surfaceWidth,viewport));
    let left=-surface/2,right=surface/2;
    for(const box of bounds)if(Number.isFinite(box.left)&&Number.isFinite(box.right)&&box.right>box.left){left=Math.min(left,box.left);right=Math.max(right,box.right);}
    return {minOffset:Math.min(0,viewport/2-right),maxOffset:Math.max(0,-viewport/2-left)};
  }
  async function measurePan({container,scene,surfaceWidth,surfaceHeight,resolveAsset=value=>value}){
    const plane=container.querySelector('.scene-render-plane');
    const ids=new Set((scene?.objects||[]).filter(o=>o.visible!==false&&(o.type==='background'||o.layer==='background')).map(o=>o.id));
    const media=[...container.querySelectorAll('.scene-render-object')].filter(node=>ids.has(node.dataset.sceneObjectId)).flatMap(node=>[...node.querySelectorAll('.scene-render-object-media')]);
    await Promise.all(media.map(node=>node.tagName==='IMG'&&!node.complete?new Promise(resolve=>{const done=()=>{node.removeEventListener('load',done);node.removeEventListener('error',done);resolve();};node.addEventListener('load',done,{once:true});node.addEventListener('error',done,{once:true});}):Promise.resolve()));
    const size=backgroundRole(scene?.background)==='stage'?await imageSize(resolveAsset(scene?.background?.asset||'')):null;
    // A rerender may have replaced the plane while media was loading.
    if(!plane||container.querySelector('.scene-render-plane')!==plane)return null;
    const rect=container.getBoundingClientRect(),pr=plane.getBoundingClientRect(),zoom=rect.width/container.clientWidth||1,center=(pr.left+pr.right)/2;
    const bounds=media.map(node=>{const box=node.getBoundingClientRect();return {left:(box.left-center)/zoom,right:(box.right-center)/zoom};});
    const backdropWidth=size?.height?Math.max(surfaceWidth,surfaceHeight*size.width/size.height):surfaceWidth;
    if(size)bounds.push({left:-backdropWidth/2,right:backdropWidth/2});
    return {...panRange(container.clientWidth,surfaceWidth,bounds),backdropWidth};
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
  const api=Object.freeze({backgroundRole,backgroundFrame,applyBackdrop,panRange,measurePan});
  if(global)global.ShiGaiSceneCamera=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
