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
  const api = Object.freeze({ layers, layoutNames, layoutName, clamp, rounded, cloneLayout, readLayout, ensureWritableLayout, commitLayout, layout, position, scale, rotation, flipX, flipY, zIndex, transform, sortVisibleObjects });
  if (global) global.ShiGaiSceneRender = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
