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
    const pattern = element('pattern', { id, width: nativeWidth*2, height: h * 2, patternUnits: 'userSpaceOnUse', x: (width - nativeWidth) / 2 });
    // Mirrored native-size tiles share the same pixels at every edge; no bitmap stretch.
    for (const [x, y, sx, sy] of [[0,0,1,1],[nativeWidth*2,0,-1,1],[0,h*2,1,-1],[nativeWidth*2,h*2,-1,-1]]) {
      const group = element('g', { transform: `translate(${x} ${y}) scale(${sx} ${sy})` });
      const crop = element('svg', { width: nativeWidth, height: h, viewBox: `0 ${start} ${nativeWidth} ${h}`, overflow: 'hidden' });
      crop.append(element('image', { href: new URL(file, mediaBase).href, width: nativeWidth, height: nativeHeight }));
      group.append(crop); pattern.append(group);
    }
    return pattern;
  }
  function layerPath(y, width, height) {
    return `M0 ${y} C${width*.12} ${y-9} ${width*.23} ${y+11} ${width*.34} ${y+5} S${width*.57} ${y-9} ${width*.69} ${y+1} S${width*.91} ${y+11} ${width} ${y} L${width} ${height} L0 ${height}Z`;
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
    const svg = element('svg', { class: 'home-underground-backdrop', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' });
    host.prepend(svg);
    let pending = false;
    function render() {
      pending = false;
      const bounds = host.getBoundingClientRect(), width = bounds.width, height = host.offsetHeight;
      const sections = [...host.querySelectorAll('.home-living-section')];
      if (!width || !height || sections.length !== 3) return;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      const boundaries = sections.slice(1).map(section => section.getBoundingClientRect().top - bounds.top + 8);
      svg.dataset.boundaries = boundaries.join(',');
      const defs = element('defs');
      defs.append(material('home-earth-shallow',0,941,width,'earth-shallow-v1.webp',1672,941),material('home-earth-middle',0,941,width,'earth-middle-v1.webp',1672,941),material('home-earth-rock',0,941,width,'earth-rock-v1.webp',1672,941),material('home-earth-lava',1430,1536,width));
      const blur = element('filter', { id: 'home-cut-shadow', x: '-10%', y: '-10%', width: '120%', height: '120%' });
      blur.append(element('feGaussianBlur', { stdDeviation: 3 })); defs.append(blur);
      const art = [element('rect', { width, height, fill: 'url(#home-earth-shallow)' }),
        element('path', { d: layerPath(boundaries[0], width, height), fill: 'url(#home-earth-middle)' }),
        element('path', { d: layerPath(boundaries[1], width, height), fill: 'url(#home-earth-rock)' }),
        element('path', { d: layerPath(height - 74, width, height), fill: 'url(#home-earth-lava)' })];
      const palettes = [['#765033','#e0ae68'],['#6c4431','#c89265'],['#4b4841','#b9b1a0']];
      sections.forEach((section, index) => {
        const entry = section.querySelector('.home-journal-entry,.home-game-embed,.home-archive-entry');
        if (!entry) return;
        const box = entry.getBoundingClientRect(), rim = width < 780 ? 13 : 24;
        const x = box.left - bounds.left - rim, y = box.top - bounds.top - rim;
        const w = box.width + rim*2, h = box.height + rim*2;
        const d = cavityPath(x, y, w, h, rim);
        const tint = element('linearGradient', { id: `home-cavity-tint-${index}`, x1: 0, y1: y, x2: 0, y2: y+65, gradientUnits: 'userSpaceOnUse' });
        tint.append(element('stop', { offset: 0, 'stop-color': '#211b15', 'stop-opacity': '.55' }),element('stop', { offset: 1, 'stop-color': '#211b15', 'stop-opacity': '.12' })); defs.append(tint);
        const cut = element('g', { 'data-cavity-depth': index });
        // The interior is transparent: exactly the same global texture remains visible.
        const inner = cavityPath(x+rim*.45,y+rim*.55,w-rim*.9,h-rim*.95,rim*.35);
        cut.append(element('path', { d: d+' '+inner, 'fill-rule': 'evenodd', fill: palettes[index][0], 'fill-opacity': '.35' }));
        cut.append(element('path', { d: inner, fill: `url(#home-cavity-tint-${index})` }));
        cut.append(element('path', { d: inner, fill: 'none', stroke: '#221c16', 'stroke-opacity': '.46', 'stroke-width': rim*.4, filter: 'url(#home-cut-shadow)' }));
        const bottom = `M${x+20} ${y+h-3} Q${x+w*.48} ${y+h+3} ${x+w-20} ${y+h-2}`;
        cut.append(element('path', { d: bottom, fill: 'none', stroke: palettes[index][1], 'stroke-opacity': '.55', 'stroke-width': 3 }));
        // Small chipped edges, with the layer's own cut-face color instead of a brown picture frame.
        for (let chip = 0; chip < 5; chip++) {
          const cy = y + 36 + (h-72)*chip/4;
          for (const side of [x, x+w]) cut.append(element('path', { d: `M${side-4} ${cy-5} Q${side+8} ${cy-2} ${side+3} ${cy+7}`, fill: 'none', stroke: palettes[index][1], 'stroke-opacity': '.45', 'stroke-width': 2 }));
        }
        art.push(cut);
      });
      svg.replaceChildren(defs, ...art);
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
