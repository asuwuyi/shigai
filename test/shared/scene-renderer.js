// Canonical Scene DOM and geometry shared by Studio and Website.
(function exposeSceneRenderer(global) {
  const UNIFIED = "unified";
  const mode = () => UNIFIED;
  const enabled = () => true;
  const rules = () => global?.ShiGaiSceneRender;
  const animationRules = () => global?.ShiGaiSceneAnimation || (typeof require === "function" ? require("./scene-animation-rules.js") : null);
  const referenceFrames = Object.freeze({ landscape: Object.freeze({ width: 1920, height: 1080 }), portrait: Object.freeze({ width: 1080, height: 1920 }) });
  const cleanType = (value) => String(value || "decoration").toLowerCase().replace(/[^a-z0-9-]/g, "") || "decoration";
  const isVideo = (source) => /\.(?:mp4|webm)(?:[?#].*)?$/i.test(String(source || ""));
  const clamp = (value, min, max, fallback) => { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; };

  function animationSettings(object) {
    const source = animationRules()?.normalize(object?.animation) || {};
    const isLegacyLoop = source.type === "loop";
    return Object.freeze({
      enabled: Boolean(isLegacyLoop && source.enabled),
      position: Object.freeze({ x: clamp(source.position?.x, -10, 10, 0), y: clamp(source.position?.y, -10, 10, 0) }),
      rotation: clamp(source.rotation, -360, 360, 0),
      duration: clamp(source.duration, .1, 120, 3),
      mode: source.mode === "seamless" ? "seamless" : source.mode === "continuous" ? "continuous" : "yoyo",
      easing: source.easing === "linear" ? "linear" : "ease-in-out"
    });
  }

  function keyframeAnimationSettings(object, layout = "landscape") {
    const source = animationRules()?.normalize(object?.animation) || {};
    const keyframes = source.type === "keyframes" ? animationRules().keyframesForLayout(source, layout) : [];
    return Object.freeze({
      type: source.type === "keyframes" ? "keyframes" : "",
      enabled: Boolean(source.type === "keyframes" && source.enabled && keyframes.length >= 2),
      duration: clamp(source.duration, .1, 120, 3),
      loop: source.loop !== false,
      easing: source.easing === "linear" ? "linear" : "ease-in-out",
      keyframes: Object.freeze(keyframes.map((keyframe) => Object.freeze({ ...keyframe, position: Object.freeze({ ...keyframe.position }) })))
    });
  }

  function prefersReducedMotion() {
    return typeof global?.matchMedia === "function" && global.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function seamlessTravel(node, metrics, requestedX, requestedY) {
    const bounds = node?.querySelector?.(".scene-render-object-visual")?.getBoundingClientRect?.() || {};
    const objectWidth = Number(bounds.width) || 0;
    const objectHeight = Number(bounds.height) || 0;
    const leftRatio = (Number.parseFloat(node?.style?.left) || 0) / 100;
    const topRatio = (Number.parseFloat(node?.style?.top) || 0) / 100;
    const x = requestedX > 0
      ? Math.max(requestedX, metrics.width * (1 - leftRatio) + objectWidth / 2)
      : requestedX < 0
        ? Math.min(requestedX, -(metrics.width * leftRatio + objectWidth / 2))
        : 0;
    const y = requestedY > 0
      ? Math.max(requestedY, metrics.height * (1 - topRatio) + objectHeight / 2)
      : requestedY < 0
        ? Math.min(requestedY, -(metrics.height * topRatio + objectHeight / 2))
        : 0;
    return Object.freeze({ x, y });
  }

  function applyObjectAnimation(node, object, metrics, playAnimation = true, layout = "landscape") {
    node?.querySelectorAll?.(".scene-render-object-orientation.is-seamless-clone")?.forEach?.((clone) => clone.remove());
    const orientation = node?.querySelector?.(".scene-render-object-orientation");
    [node, orientation].forEach((target) => target?.getAnimations?.().forEach((animation) => animation.cancel()));
    if (!node) return false;
    node.style.removeProperty("transform");
    orientation?.style?.removeProperty?.("transform");
    node.removeAttribute("data-scene-animation-active");
    node.removeAttribute("data-scene-animation-type");
    node.removeAttribute("data-scene-seamless-x");
    node.removeAttribute("data-scene-seamless-y");
    const keyframeSettings = keyframeAnimationSettings(object, layout);
    if (playAnimation && keyframeSettings.enabled && !prefersReducedMotion() && typeof node.animate === "function") {
      const motionFrames = keyframeSettings.keyframes.map((keyframe) => ({
        offset: keyframe.offset,
        transform: `translate(${keyframe.position.x * metrics.width}px, ${keyframe.position.y * metrics.height}px) rotate(${keyframe.rotation}deg) scale(${keyframe.scale})`
      }));
      const options = { duration: keyframeSettings.duration * 1000, iterations: keyframeSettings.loop ? Infinity : 1, easing: keyframeSettings.easing, fill: "both" };
      node.animate(motionFrames, options);
      if (orientation && keyframeSettings.keyframes.some((keyframe) => keyframe.flipX)) {
        orientation.animate(keyframeSettings.keyframes.map((keyframe) => ({ offset: keyframe.offset, transform: `scaleX(${keyframe.flipX ? -1 : 1})`, easing: "steps(1, end)" })), options);
      }
      node.dataset.sceneAnimationActive = "true";
      node.dataset.sceneAnimationType = "keyframes";
      return true;
    }
    const settings = animationSettings(object);
    if (!playAnimation || !settings.enabled || prefersReducedMotion() || typeof node.animate !== "function") return false;
    const requestedX = settings.position.x * metrics.width;
    const requestedY = settings.position.y * metrics.height;
    const travel = settings.mode === "seamless" ? seamlessTravel(node, metrics, requestedX, requestedY) : { x: requestedX, y: requestedY };
    const { x, y } = travel;
    if (!x && !y && !settings.rotation) return false;
    if (settings.mode === "seamless" && orientation?.cloneNode && (x || y)) {
      const clone = orientation.cloneNode(true);
      clone.classList.add("is-seamless-clone");
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll?.("[id]")?.forEach?.((element) => element.removeAttribute("id"));
      clone.style.transform = `translate(${-x}px, ${-y}px)`;
      node.append(clone);
      node.dataset.sceneSeamlessX = String(x);
      node.dataset.sceneSeamlessY = String(y);
    }
    const transform = `translate(${x}px, ${y}px) rotate(${settings.rotation}deg)`;
    node.animate([
      { transform: "translate(0px, 0px) rotate(0deg)" },
      { transform }
    ], {
      duration: settings.duration * 1000,
      iterations: Infinity,
      direction: settings.mode === "yoyo" ? "alternate" : "normal",
      easing: settings.easing
    });
    node.dataset.sceneAnimationActive = "true";
    node.dataset.sceneAnimationType = settings.mode === "seamless" ? "seamless" : "loop";
    return true;
  }

  function setAttributes(node, attributes) {
    if (!attributes || typeof attributes !== "object") return;
    Object.entries(attributes).forEach(([name, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (name === "tabIndex") node.tabIndex = Number(value);
      else if (name === "className") return;
      else node.setAttribute(name, value === true ? "" : String(value));
    });
  }

  function createMedia(documentRef, object, source) {
    if (!source) return null;
    const media = documentRef.createElement(isVideo(source) ? "video" : "img");
    media.className = "scene-render-object-media";
    media.src = source;
    media.alt = object?.media?.alt || object?.name || "";
    media.draggable = false;
    media.decoding = "async";
    media.fetchPriority = object?.type === "background" ? "high" : "auto";
    if (media.tagName === "VIDEO") {
      media.autoplay = true;
      media.muted = true;
      media.loop = true;
      media.playsInline = true;
      media.preload = "metadata";
      media.controls = false;
      ["autoplay", "muted", "loop", "playsinline"].forEach((attribute) => media.setAttribute(attribute, ""));
      media.addEventListener("canplay", () => media.play().catch(() => {}), { once: true });
    }
    return media;
  }

  const fitMode = (value) => value === "cover" || value === "stretch" ? value : "contain";

  function surfaceMetrics(container, layout, requestedFitMode = "contain", frameOptions = {}) {
    const baseFrame = referenceFrames[layout] || referenceFrames.landscape;
    const widthMultiplier = layout === "portrait" ? clamp(frameOptions.widthMultiplier, 1, 3, 1) : 1;
    const frame = Object.freeze({ width: baseFrame.width * widthMultiplier, height: baseFrame.height });
    const width = Number(container?.clientWidth) || Number(container?.getBoundingClientRect?.().width) || frame.width;
    const height = Number(container?.clientHeight) || Number(container?.getBoundingClientRect?.().height) || frame.height;
    const resolvedFitMode = fitMode(requestedFitMode);
    const scale = resolvedFitMode === "cover"
      ? Math.max(width / frame.width, height / frame.height)
      : Math.min(width / frame.width, height / frame.height);
    return Object.freeze({ scale, width: resolvedFitMode === "stretch" ? width : frame.width * scale, height: resolvedFitMode === "stretch" ? height : frame.height * scale, frame, fitMode: resolvedFitMode });
  }
  const viewportScale = (container, layout, requestedFitMode, frameOptions) => surfaceMetrics(container, layout, requestedFitMode, frameOptions).scale;

  function mappedTransform(object, layout, surfaceScale) {
    const renderRules = rules();
    return `translate(-50%, -50%) rotate(${renderRules.rotation(object, layout)}deg) scale(${renderRules.scale(object, layout) * surfaceScale}) scaleX(${renderRules.flipX(object) ? -1 : 1}) scaleY(${renderRules.flipY(object) ? -1 : 1})`;
  }

  function applyObjectStyle(node, object, layout, surfaceScale = 1) {
    const renderRules = rules();
    if (!node || !renderRules) return null;
    const visual = node.querySelector(".scene-render-object-visual");
    const position = renderRules.position(object, layout);
    node.style.left = `${position.x * 100}%`;
    node.style.top = `${position.y * 100}%`;
    node.style.zIndex = String(renderRules.zIndex(object));
    node.dataset.sceneScale = String(renderRules.scale(object, layout));
    node.dataset.sceneViewportScale = String(surfaceScale);
    if (visual) visual.style.transform = mappedTransform(object, layout, surfaceScale);
    return node;
  }

  function createObjectNode({ documentRef, object, layout, surfaceScale, surfaceMetricsValue, resolveMediaSource, objectAttributes, onMediaError, playAnimation }) {
    const node = documentRef.createElement("div");
    const visual = documentRef.createElement("div");
    node.className = `scene-render-object is-${cleanType(object?.type)}`;
    visual.className = "scene-render-object-visual";
    node.dataset.sceneObjectId = String(object?.id || "");
    setAttributes(node, typeof objectAttributes === "function" ? objectAttributes(object) : null);

    const source = String(typeof resolveMediaSource === "function" ? resolveMediaSource(object) || "" : object?.media?.src || "").trim();
    const media = createMedia(documentRef, object, source);
    if (media) {
      media.addEventListener("error", (event) => {
        node.classList.add("has-media-error");
        if (typeof onMediaError === "function") onMediaError({ event, node, object, media });
      }, { once: true });
      visual.append(media);
    }
    if (object?.text || !media) {
      const text = documentRef.createElement("span");
      text.className = "scene-render-object-text";
      text.textContent = object?.text || object?.name || "";
      visual.append(text);
    }
    const orientation = documentRef.createElement("div");
    orientation.className = "scene-render-object-orientation";
    orientation.append(visual);
    node.append(orientation);
    applyObjectStyle(node, object, layout, surfaceScale);
    const metrics = { width: surfaceMetricsValue.width, height: surfaceMetricsValue.height };
    applyObjectAnimation(node, object, metrics, playAnimation !== false, layout);
    if (media && animationSettings(object).mode === "seamless") {
      const refreshSeamlessBounds = () => applyObjectAnimation(node, object, metrics, playAnimation !== false, layout);
      media.addEventListener(media.tagName === "VIDEO" ? "loadedmetadata" : "load", refreshSeamlessBounds, { once: true });
      if ((media.tagName === "VIDEO" && media.readyState >= 1) || (media.tagName !== "VIDEO" && media.complete)) global?.queueMicrotask?.(refreshSeamlessBounds);
    }
    return node;
  }

  function renderScene(options = {}) {
    const renderRules = rules();
    const { container, scene } = options;
    if (!renderRules) throw new Error("ShiGaiSceneRender is required.");
    if (!container || typeof container.replaceChildren !== "function") throw new TypeError("A Scene container is required.");
    const documentRef = container.ownerDocument || global.document;
    const layout = renderRules.layoutName(options.layout);
    const metrics = surfaceMetrics(container, layout, options.fitMode, { widthMultiplier: options.frameWidthMultiplier });
    const surfaceScale = metrics.scale;
    const plane = documentRef.createElement("div");
    plane.className = "scene-render-plane";
    plane.dataset.sceneLayout = layout;
    plane.style.width = `${metrics.width}px`;
    plane.style.height = `${metrics.height}px`;
    const fragment = documentRef.createDocumentFragment();
    const objects = renderRules.sortVisibleObjects(scene);
    objects.forEach((object) => fragment.append(createObjectNode({ ...options, documentRef, object, layout, surfaceScale, surfaceMetricsValue: metrics })));
    plane.append(fragment);
    container.replaceChildren(plane);
    container.dataset.sceneRenderer = UNIFIED;
    container.dataset.sceneId = String(scene?.id || "");
    container.dataset.sceneLayout = layout;
    container.dataset.sceneFitMode = metrics.fitMode;
    container.dataset.sceneViewportScale = String(surfaceScale);
    container.dataset.sceneFrameWidthMultiplier = String(metrics.frame.width / referenceFrames[layout].width);
    if (options.applyBackground !== false && scene?.background?.color) container.style.background = scene.background.color;
    return Object.freeze({ mode: UNIFIED, rendered: true, layout, fitMode: metrics.fitMode, objectCount: objects.length, viewportScale: surfaceScale, referenceFrame: metrics.frame, surfaceWidth: metrics.width, surfaceHeight: metrics.height });
  }

  function getObjectNode(container, objectId) {
    return Array.from(container?.querySelectorAll?.("[data-scene-object-id]") || []).find((node) => node.dataset.sceneObjectId === String(objectId)) || null;
  }

  function updateObject({ container, object, layout = "landscape", fitMode: requestedFitMode, playAnimation = true } = {}) {
    const node = getObjectNode(container, object?.id);
    if (!node) return Object.freeze({ mode: UNIFIED, updated: false, reason: "object-not-found" });
    const normalizedLayout = rules().layoutName(layout);
    const metrics = surfaceMetrics(container, normalizedLayout, requestedFitMode || container?.dataset?.sceneFitMode, { widthMultiplier: container?.dataset?.sceneFrameWidthMultiplier });
    const plane = node.closest?.(".scene-render-plane");
    if (plane) { plane.style.width = `${metrics.width}px`; plane.style.height = `${metrics.height}px`; }
    applyObjectStyle(node, object, normalizedLayout, metrics.scale);
    applyObjectAnimation(node, object, metrics, playAnimation, normalizedLayout);
    container.dataset.sceneViewportScale = String(metrics.scale);
    container.dataset.sceneFitMode = metrics.fitMode;
    return Object.freeze({ mode: UNIFIED, updated: true });
  }

  function resizeScene({ container, scene, layout = "landscape", fitMode: requestedFitMode, playAnimation = true } = {}) {
    if (!container || !scene) return Object.freeze({ mode: UNIFIED, resized: false, reason: "missing-container-or-scene" });
    const normalizedLayout = rules().layoutName(layout);
    const metrics = surfaceMetrics(container, normalizedLayout, requestedFitMode || container?.dataset?.sceneFitMode, { widthMultiplier: container?.dataset?.sceneFrameWidthMultiplier });
    if (!metrics.width || !metrics.height) return Object.freeze({ mode: UNIFIED, resized: false, reason: "zero-size-container" });
    const plane = container.querySelector?.(".scene-render-plane");
    if (plane) { plane.style.width = `${metrics.width}px`; plane.style.height = `${metrics.height}px`; }
    rules().sortVisibleObjects(scene).forEach((object) => updateObject({ container, object, layout: normalizedLayout, fitMode: metrics.fitMode, playAnimation }));
    container.dataset.sceneViewportScale = String(metrics.scale);
    container.dataset.sceneFitMode = metrics.fitMode;
    return Object.freeze({ mode: UNIFIED, resized: true, layout: normalizedLayout, fitMode: metrics.fitMode, viewportScale: metrics.scale });
  }

  const api = Object.freeze({ UNIFIED, referenceFrames, mode, enabled, fitMode, surfaceMetrics, viewportScale, mappedTransform, animationSettings, keyframeAnimationSettings, applyObjectAnimation, renderScene, updateObject, resizeScene, getObjectNode });
  if (global) global.ShiGaiSceneRenderer = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
