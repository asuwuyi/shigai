/* A single decorative surface in document coordinates. No content or Scene state. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const mediaBase = new URL('../images/home/', document.currentScript.src);
  function element(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }
  function material(id, start, end, width, file = 'soil-cutaway-v1.webp', nativeWidth = 1024, nativeHeight = 1536) {
    const h = end - start;
    const repeatWidth = (nativeWidth - 1) * 2, repeatHeight = (h - 1) * 2;
    const pattern = element('pattern', { id, width: repeatWidth, height: repeatHeight, patternUnits: 'userSpaceOnUse', x: (width - nativeWidth) / 2 });
    // Native-size mirrored tiles overlap at their edges. Adjacent exact clip
    // boundaries otherwise leak underpaint at fractional device-pixel positions.
    for (const [x, y, sx, sy] of [[0,0,1,1],[repeatWidth,0,-1,1],[0,repeatHeight,1,-1],[repeatWidth,repeatHeight,-1,-1]]) {
      const group = element('g', { transform: `translate(${x} ${y}) scale(${sx} ${sy})` });
      const crop = element('svg', { width: nativeWidth, height: h, viewBox: `0 ${start} ${nativeWidth} ${h}`, overflow: 'hidden' });
      crop.append(element('image', { 'data-earth-source': new URL(file, mediaBase).href, width: nativeWidth, height: nativeHeight }));
      group.append(crop); pattern.append(group);
    }
    return pattern;
  }
  function layerPath(y, width, height) {
    return `M0 ${y} C${width*.12} ${y-9} ${width*.23} ${y+11} ${width*.34} ${y+5} S${width*.57} ${y-9} ${width*.69} ${y+1} S${width*.91} ${y+11} ${width} ${y} L${width} ${height} L0 ${height}Z`;
  }
  function stageMaterial(height) {
    // Render only the measured occupied strip, preserving the PNG's native alpha.
    const scale = height / 136, tileWidth = 2172 * scale;
    const pattern = element('pattern', { id: 'home-stage-wood', width: tileWidth*2, height, patternUnits: 'userSpaceOnUse' });
    for (const [x, flip] of [[0,1],[tileWidth*2,-1]]) {
      const group = element('g', { transform: `translate(${x} 0) scale(${flip} 1)` });
      const crop = element('svg', { width: tileWidth, height, viewBox: '0 305 2172 136', overflow: 'hidden' });
      crop.append(element('image', { 'data-earth-source': new URL('stage-front-roots-v1.webp', mediaBase).href, width: 2172, height: 724 }));
      group.append(crop); pattern.append(group);
    }
    return pattern;
  }
  function cavityPath(x, y, w, h, rim) {
    const r = Math.min(34, w / 9, h / 9), n = Math.min(19, rim * .8);
    return `M${x+r} ${y} C${x+w*.27} ${y-n} ${x+w*.36} ${y+n} ${x+w*.5} ${y}
      S${x+w*.79} ${y-n} ${x+w-r} ${y+n}
      Q${x+w+n} ${y} ${x+w} ${y+r}
      C${x+w-n} ${y+h*.25} ${x+w+n} ${y+h*.42} ${x+w} ${y+h*.56}
      S${x+w-n} ${y+h*.81} ${x+w} ${y+h-r}
      Q${x+w+n} ${y+h} ${x+w-r} ${y+h}
      C${x+w*.74} ${y+h+n} ${x+w*.57} ${y+h-n} ${x+w*.42} ${y+h}
      S${x+w*.18} ${y+h+n} ${x+r} ${y+h}
      Q${x-n} ${y+h} ${x} ${y+h-r}
      C${x+n} ${y+h*.73} ${x-n} ${y+h*.57} ${x} ${y+h*.41}
      S${x+n} ${y+h*.18} ${x} ${y+r} Q${x-n} ${y} ${x+r} ${y}Z`;
  }
  function install() {
    const host = document.querySelector('[data-home-sections]');
    if (!host || host.querySelector('.home-underground-backdrop')) return;
    const svg = element('svg', { class: 'home-underground-backdrop', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none', fill: 'none' });
    host.prepend(svg);
    const stage = document.createElement('div');
    stage.className = 'home-stage-seam'; stage.setAttribute('aria-hidden','true');
    host.insertBefore(stage, svg.nextSibling);
    // Keep paint servers, images and large paint nodes alive across every reflow.
    // Replacing the complete resource tree is unnecessary and risks blank frames.
    const specs = [
      ['home-earth-shallow','earth-shallow-v1.webp',0,941,1672,941,'#c99242'],
      ['home-earth-middle','earth-middle-v1.webp',0,941,1672,941,'#a7623e'],
      ['home-earth-rock','earth-rock-v1.webp',0,941,1672,941,'#847866'],
      ['home-earth-lava','soil-cutaway-v1.webp',1430,1536,1024,1536,'#ad4922']
    ];
    const defs = element('defs');
    const wood = stageMaterial(80); defs.append(wood);
    const patterns = specs.map(([id,file,start,end,w,h]) => {
      const pattern = material(id,start,end,0,file,w,h); defs.append(pattern); return pattern;
    });
    svg.append(defs);
    const surfaces = specs.map(([id,,,,,,color],index) => {
      const tag = index ? 'path' : 'rect';
      const base = element(tag, { fill: color });
      const paint = element(tag, { fill: 'none', 'data-earth-surface': id });
      svg.append(base,paint); return { base, paint };
    });
    const cuts = [0,1,2].map(index => {
      const tint = element('linearGradient', { id: 'home-cavity-tint-'+index, x1: 0, x2: 0, gradientUnits: 'userSpaceOnUse' });
      tint.append(element('stop', { offset: 0, 'stop-color': '#211b15', 'stop-opacity': '.55' }),element('stop', { offset: 1, 'stop-color': '#211b15', 'stop-opacity': '.12' }));
      defs.append(tint);
      const group = element('g', { 'data-cavity-depth': index }); svg.append(group);
      return { tint, group };
    });
    const front = element('rect', { 'data-stage-front': '', fill: '#79502d' }); svg.append(front);
    // Decode once; failures leave the layer's warm solid underpaint, never black.
    // Strong references keep these decoded resources reusable during scrolling.
    const files = [...specs.map(spec => spec[1]),'stage-front-roots-v1.webp'];
    const retainedImages = files.map(() => { const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'low'; return image; });
    const textureStates = files.map(() => 'pending');
    const textureQueue = [];
    let activeTexture = false;
    svg.dataset.textureState = 'loading';
    // An existing SVG pattern does not use its fallback color when its image fails.
    // Do not paint that pattern until the resource has actually decoded.
    function loadTexture(index) {
      if (textureStates[index] !== 'pending') return;
      textureStates[index] = 'queued'; textureQueue.push(index); drainTextures();
    }
    function drainTextures() {
      if (activeTexture || !textureQueue.length) return;
      activeTexture = true;
      const index = textureQueue.shift();
      textureStates[index] = 'loading';
      const image = retainedImages[index]; image.src = new URL(files[index],mediaBase).href;
      image.decode().then(()=> {
        const pattern = index < patterns.length ? patterns[index] : wood;
        pattern.querySelectorAll('[data-earth-source]').forEach(node => set(node,{href:node.getAttribute('data-earth-source')}));
        if(index < surfaces.length) set(surfaces[index].paint,{fill:'url(#'+specs[index][0]+')'});
        else set(front,{fill:'url(#home-stage-wood) #79502d'});
        textureStates[index] = 'ready';
      },()=> { textureStates[index] = 'fallback'; }).then(()=> {
        activeTexture = false;
        svg.dataset.textureState = textureStates.includes('fallback') ? 'fallback' : textureStates.every(value=>value==='ready') ? 'ready' : 'loading';
        svg.dataset.decodedTextures = String(textureStates.filter(value=>value==='ready').length);
        schedule();
        drainTextures();
      });
    }
    // Do not start the whole underground download while the Scene is visible.
    // Keep every created paint resource alive; only its first request is deferred.
    if ('IntersectionObserver' in window) {
      const bottom = document.createElement('span'); bottom.setAttribute('aria-hidden','true');
      Object.assign(bottom.style,{position:'absolute',bottom:'0',left:'0',width:'1px',height:'1px',pointerEvents:'none'}); host.append(bottom);
      const targets = new Map([...host.querySelectorAll('.home-living-section')].map((node,index)=>[node,index]));
      targets.set(bottom,3); targets.set(stage,4);
      const loader = new IntersectionObserver(entries=>entries.forEach(entry=> {
        if (!entry.isIntersecting) return;
        loadTexture(targets.get(entry.target)); loader.unobserve(entry.target);
      }),{rootMargin:'350px'});
      targets.forEach((index,node)=>loader.observe(node));
    } else files.forEach((file,index)=>loadTexture(index));
    let pending = false, previousGeometry = '';
    function set(node,attrs) {
      Object.entries(attrs).forEach(([key,value]) => { if(node.getAttribute(key)!==String(value)) node.setAttribute(key,String(value)); });
    }
    function render() {
      pending = false;
      const bounds = host.getBoundingClientRect(), width = bounds.width, height = host.offsetHeight;
      const sections = [...host.querySelectorAll('.home-living-section')];
      if (!width || !height || sections.length !== 3) return;
      const stageHeight = stage.getBoundingClientRect().height;
      const entries = sections.map(section => section.querySelector('.home-journal-entry,.home-game-embed,.home-archive-entry')?.getBoundingClientRect());
      const boundaries = sections.slice(1).map(section => section.getBoundingClientRect().top - bounds.top + 8);
      const geometry = JSON.stringify([width,height,stageHeight,...boundaries,...entries.flatMap(box=>box ? [box.left-bounds.left,box.top-bounds.top,box.width,box.height] : [])].map(value=>Math.round(value*2)/2));
      if (geometry === previousGeometry) return;
      previousGeometry = geometry;
      svg.dataset.paintUpdates = String(Number(svg.dataset.paintUpdates||0)+1);
      svg.dataset.decodedTextures = String(retainedImages.filter(image=>image.complete && image.naturalWidth).length);
      set(svg,{viewBox:'0 0 '+width+' '+height});
      svg.dataset.boundaries = boundaries.join(',');
      patterns.forEach((pattern,index)=>set(pattern,{x:(width-specs[index][4])/2}));
      set(wood,{patternTransform:'scale('+(stageHeight/80)+')'});
      surfaces.forEach(({base,paint},index) => {
        const attrs = index ? {d:layerPath(index===3 ? height-74 : boundaries[index-1],width,height)} : {width,height};
        set(base,attrs); set(paint,attrs);
      });
      const palettes = [['#765033','#e0ae68'],['#6c4431','#c89265'],['#4b4841','#b9b1a0']];
      entries.forEach((box,index) => {
        const {tint,group}=cuts[index]; if(!box){group.replaceChildren();return;}
        const rim = width < 780 ? 13 : 24;
        const x = box.left-bounds.left-rim, y = box.top-bounds.top-rim;
        const w = box.width+rim*2, h = box.height+rim*2;
        const d = cavityPath(x,y,w,h,rim);
        const inner = cavityPath(x+rim*.45,y+rim*.55,w-rim*.9,h-rim*.95,rim*.35);
        set(tint,{y1:y,y2:y+65});
        const art = [
          element('path',{d:d+' '+inner,'fill-rule':'evenodd',fill:palettes[index][0],'fill-opacity':'.35'}),
          element('path',{d:inner,fill:'url(#home-cavity-tint-'+index+') none'})
        ];
        // Feathered translucent strokes avoid a full-page offscreen blur buffer.
        for(const [spread,opacity] of [[.8,.025],[.62,.04],[.45,.06],[.28,.09],[.12,.12]]) {
          art.push(element('path',{d:inner,fill:'none',stroke:'#221c16','stroke-opacity':opacity,'stroke-width':rim*spread}));
        }
        art.push(element('path',{d:'M'+(x+20)+' '+(y+h-3)+' Q'+(x+w*.48)+' '+(y+h+3)+' '+(x+w-20)+' '+(y+h-2),fill:'none',stroke:palettes[index][1],'stroke-opacity':'.55','stroke-width':3}));
        for(let chip=0;chip<5;chip++){
          const cy=y+36+(h-72)*chip/4;
          for(const side of [x,x+w]) art.push(element('path',{d:'M'+(side-4)+' '+(cy-5)+' Q'+(side+8)+' '+(cy-2)+' '+(side+3)+' '+(cy+7),fill:'none',stroke:palettes[index][1],'stroke-opacity':'.45','stroke-width':2}));
        }
        // Only small vector edge paths change. Textures and paint servers remain.
        group.replaceChildren(...art);
      });
      set(front,{width,height:stageHeight});
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }
    new ResizeObserver(schedule).observe(host);
    new MutationObserver(records => { if (records.some(record => !svg.contains(record.target))) schedule(); }).observe(host, { childList: true, subtree: true });
    document.fonts?.ready.then(schedule);
    schedule();
  }
  window.addEventListener('shi-gai:home-sections-ready', install);
  if (document.querySelector('.home-living-section')) install();
})();
