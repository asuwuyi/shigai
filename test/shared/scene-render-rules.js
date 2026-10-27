// Shared Scene placement rules. This is the sole responsive-layout authority for Studio, export tests and Website render.
(function exposeSceneRenderRules(global) {
  const layers = Object.freeze(["background", "far", "mid", "character", "front", "overlay"]);
  const layoutNames = Object.freeze(["landscape", "portrait"]);
  const clamp = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
  };
  const rounded = (value, minimum, maximum, fallback) => Number(clamp(value, minimum, maximum, fallback).toFixed(3));
  const layoutName = (value) => layoutNames.includes(value) ? value : "landscape";
  const cloneLayout = (value, fallback = {}) => {
    const source = value && typeof value === "object" ? value : {};
    const position = source.position && typeof source.position === "object" ? source.position : fallback.position || {};
    return {
      position: { x: rounded(position.x, -10, 10, .5), y: rounded(position.y, -10, 10, .5) },
      scale: rounded(source.scale ?? fallback.scale, .05, 5, 1),
      rotation: rounded(source.rotation ?? fallback.rotation, -360, 360, 0)
    };
  };
  // Legacy fields are migration input only. They are never a runtime edit target.
  const legacyLayout = (object) => cloneLayout({ position: object?.position, scale: object?.scale, rotation: object?.rotation });
  const readLayout = (object, requestedLayout = "landscape") => {
    const name = layoutName(requestedLayout);
    const layouts = object?.layouts && typeof object.layouts === "object" ? object.layouts : null;
    if (layouts?.[name]) return cloneLayout(layouts[name]);
    if (layouts?.landscape) return cloneLayout(layouts.landscape);
    return legacyLayout(object);
  };
  // This migration guard is only used on a real mutation. It always creates deep, independent layouts.
  const ensureWritableLayout = (object, requestedLayout = "landscape") => {
    if (!object || typeof object !== "object") return null;
    const name = layoutName(requestedLayout);
    object.layouts = object.layouts && typeof object.layouts === "object" ? object.layouts : {};
    if (!object.layouts.landscape) object.layouts.landscape = readLayout(object, "landscape");
    if (!object.layouts.portrait) object.layouts.portrait = cloneLayout(object.layouts.landscape);
    return object.layouts[name];
  };
  const commitLayout = (object, requestedLayout, nextLayout) => {
    const name = layoutName(requestedLayout);
    const previous = ensureWritableLayout(object, name);
    if (!previous) return null;
    const next = cloneLayout(nextLayout, previous);
    object.layouts[name] = next;
    return next;
  };
  const layout = readLayout;
  const position = (object, requestedLayout) => readLayout(object, requestedLayout).position;
  const scale = (object, requestedLayout) => readLayout(object, requestedLayout).scale;
  const rotation = (object, requestedLayout) => readLayout(object, requestedLayout).rotation;
  const flipX = (object) => object?.flipX === true;
  const flipY = (object) => object?.flipY === true;
  const layerIndex = (object) => Math.max(0, layers.indexOf(object?.layer));
  const zIndex = (object) => (layerIndex(object) + 1) * 1000 + Math.max(0, Number(object?.order) || 0);
  const transform = (object, requestedLayout) => "translate(-50%, -50%) rotate(" + rotation(object, requestedLayout) + "deg) scale(" + scale(object, requestedLayout) + ") scaleX(" + (flipX(object) ? -1 : 1) + ") scaleY(" + (flipY(object) ? -1 : 1) + ")";
  const sortVisibleObjects = (scene) => [...(scene?.objects || [])]
    .filter((object) => object?.visible !== false)
    .sort((first, second) => zIndex(first) - zIndex(second));
  // Device font stacks only. Never accept raw CSS or silently download fonts.
  const fontFamilies=Object.freeze([
    Object.freeze({value:'default',label:'系統預設',stack:''}),
    Object.freeze({value:'sans',label:'黑體',stack:'"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif'}),
    Object.freeze({value:'serif',label:'明體／襯線',stack:'"Songti TC", "PMingLiU", "Noto Serif TC", serif'}),
    Object.freeze({value:'rounded',label:'圓體',stack:'"Yuanti TC", "Yuanti SC", "Arial Rounded MT Bold", "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'handwritten',label:'楷體／手寫感',stack:'"Kaiti TC", "BiauKai", "DFKai-SB", "STKaiti", KaiTi, cursive'}),
    Object.freeze({value:'mono',label:'等寬（數字）',stack:'"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "PingFang TC", "Microsoft JhengHei", monospace'}),
    Object.freeze({value:'arial',label:'Arial',group:'英文字型',stack:'Arial, "Helvetica Neue", "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'helvetica',label:'Helvetica',group:'英文字型',stack:'"Helvetica Neue", Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'georgia',label:'Georgia',group:'英文字型',stack:'Georgia, "Times New Roman", "Songti TC", PMingLiU, serif'}),
    Object.freeze({value:'times',label:'Times New Roman',group:'英文字型',stack:'"Times New Roman", Times, "Songti TC", PMingLiU, serif'}),
    Object.freeze({value:'verdana',label:'Verdana',group:'英文字型',stack:'Verdana, Geneva, "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'trebuchet',label:'Trebuchet MS',group:'英文字型',stack:'"Trebuchet MS", Arial, "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'impact',label:'Impact',group:'英文字型',stack:'Impact, Haettenschweiler, "Arial Narrow", Arial, "PingFang TC", "Microsoft JhengHei", sans-serif'}),
    Object.freeze({value:'comic',label:'Comic Sans MS',group:'英文字型',stack:'"Comic Sans MS", "Comic Sans", "Chalkboard SE", "PingFang TC", "Microsoft JhengHei", cursive'}),
    Object.freeze({value:'courier',label:'Courier New',group:'英文字型',stack:'"Courier New", Courier, Menlo, Consolas, "PingFang TC", "Microsoft JhengHei", monospace'}),
    Object.freeze({value:'palatino',label:'Palatino',group:'英文字型',stack:'Palatino, "Palatino Linotype", "Book Antiqua", "Songti TC", PMingLiU, serif'})
  ]);
  const fontFamily=value=>fontFamilies.find(item=>item.value===value)?.stack||'';
  function normalizeTextDisplay(value) {
    const s=value&&typeof value==='object'?value:{};
    let timeZone=['scene','visitor'].includes(s.timeZone)?s.timeZone:'scene';
    if(typeof s.timeZone==='string'&&!['scene','visitor'].includes(s.timeZone)){try{new Intl.DateTimeFormat('en',{timeZone:s.timeZone}).format();timeZone=s.timeZone.slice(0,80);}catch{}}
    return {version:1,source:['manual','time','date','datetime'].includes(s.source)?s.source:'manual',timeZone,hour12:s.hour12===true,showSeconds:s.showSeconds===true,weekday:s.weekday!==false,mode:['wrap','ellipsis','marquee'].includes(s.mode)?s.mode:'wrap',lines:Math.round(clamp(s.lines,1,6,2)),speed:rounded(s.speed,10,160,40),direction:s.direction==='right'?'right':'left',gap:rounded(s.gap,24,240,64)};
  }
  function normalizeTextBubble(value) {
    const source = value && typeof value === 'object' ? value : {};
    const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
    const placement = name => {
      const entry = source.layouts?.[name] || {};
      return { anchor: ['above','below','left','right','center'].includes(entry.anchor) ? entry.anchor : 'above', x: rounded(entry.x,-960,960,0), y: rounded(entry.y,-960,960,0), scale: rounded(entry.scale,.1,10,1), rotation: rounded(entry.rotation,-720,720,0), fontSize: rounded(entry.fontSize ?? source.fontSize,12,160,48), maxWidth: rounded(entry.maxWidth ?? source.maxWidth,120,960,480) };
    };
    const animationRules = global?.ShiGaiSceneAnimation || (typeof require === 'function' ? require('./scene-animation-rules.js') : null);
    return { enabled: source.enabled === true, ...(fontFamily(source.fontFamily)?{fontFamily:source.fontFamily}:{}), color: color(source.color,'#34271f'), backgroundColor: color(source.backgroundColor,'#fffdf5'), fontWeight: [400,500,600,700,800,900].includes(Number(source.fontWeight)) ? Number(source.fontWeight) : 600, radius: rounded(source.radius,0,80,24), layouts: { landscape: placement('landscape'), portrait: placement('portrait') }, ...(source.animation && animationRules ? { animation: animationRules.normalize(source.animation) } : {}) };
  }
  const api = Object.freeze({ fontFamilies, fontFamily, normalizeTextDisplay, normalizeTextBubble, layers, layoutNames, layoutName, clamp, rounded, cloneLayout, readLayout, ensureWritableLayout, commitLayout, layout, position, scale, rotation, flipX, flipY, zIndex, transform, sortVisibleObjects });
  if (global) global.ShiGaiSceneRender = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
