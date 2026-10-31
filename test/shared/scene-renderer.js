// Canonical Scene DOM and geometry shared by Studio and Website.
(function exposeSceneRenderer(global) {
  const eventControllers = new WeakMap();
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

  function applyChannelAnimation(target, source, layout, metrics, text = false, editorSelectable = false) {
    if (!target || !source?.enabled || !source.channels?.[layout]) return false;
    let active = false;
    const options = { duration:source.duration*1000, iterations:source.loop ? Infinity : 1, fill:"both", easing:"linear" };
    for (const property of animationRules().properties) {
      const channel = source.channels[layout][property];
      const legacy = property === 'opacity' ? [] : (source.keyframes?.[layout] || []).map(f => ({offset:f.offset,value:f[property]}));
      let frames = channel ? channel.enabled ? channel.keyframes : [] : legacy;
      if (!frames.length) continue;
      frames = [...frames];
      if (frames[0].offset > 0) frames.unshift({...frames[0],offset:0});
      if (frames.at(-1).offset < 1) frames.push({...frames.at(-1),offset:1});
      const keyframes = frames.map(frame => {
        const value = frame.value, entry = {offset:frame.offset,easing:source.easing};
        if (property === 'position') entry.translate = `${value.x*(text ? 1 : metrics.width)}px ${value.y*(text ? 1 : metrics.height)}px`;
        if (property === 'rotation') entry.rotate = `${value}deg`;
        if (property === 'scale') entry.scale = String(value);
        if (property === 'opacity') { entry.opacity = value; if (!text && !editorSelectable) entry.visibility = value === 0 ? 'hidden' : 'visible'; }
        return entry;
      });
      const effect = target.animate(keyframes,options); effect.id = `scene-channel-${text ? 'text' : 'object'}-${property}`;
      if (property === 'opacity' && text && !editorSelectable) {
        const hit = target.animate(frames.map(f => ({offset:f.offset,pointerEvents:f.value === 0 ? 'none' : 'auto',easing:'steps(1,end)'})),options); hit.id = 'scene-text-hit';
      }
      active = true;
    }
    return active;
  }

  function applyObjectAnimation(node, object, metrics, playAnimation = true, layout = "landscape", editorSelectable = false) {
    node?.querySelectorAll?.(".scene-render-object-orientation.is-seamless-clone")?.forEach?.((clone) => {clone.getAnimations?.({subtree:true}).forEach(a=>a.cancel());clone.remove();});
    const orientation = node?.querySelector?.(".scene-render-object-orientation");
    const speechCounter = node?.querySelector?.(".scene-speech-counterflip");
    const speechAnchor = node?.querySelector?.(".scene-speech-anchor");
    const text = node?.querySelector?.('.scene-speech-bubble, .scene-render-object-text');
    [node, orientation, speechCounter, speechAnchor, text].forEach((target) => target?.getAnimations?.().forEach((animation) => animation.cancel()));
    if (!node) return false;
    node.style.removeProperty("transform");
    [node,text].forEach(target => ['translate','rotate','scale','opacity','visibility'].forEach(p => target?.style.removeProperty(p)));
    orientation?.style?.removeProperty?.("transform");
    node.removeAttribute("data-scene-animation-active");
    node.removeAttribute("data-scene-animation-type");
    node.removeAttribute("data-scene-seamless-x");
    node.removeAttribute("data-scene-seamless-y");
    const keyframeSettings = keyframeAnimationSettings(object, layout);
    const source = animationRules().normalize(object.animation);
    const canPlay = playAnimation && !prefersReducedMotion() && typeof node.animate === 'function';
    const textAnimated = canPlay && text && applyChannelAnimation(text, rules()?.normalizeTextBubble(object.textBubble).animation, layout, metrics, true, editorSelectable);
    if (canPlay && source.channels?.[layout] && Object.keys(source.channels[layout]).length) {
      const animated = applyChannelAnimation(node,source,layout,metrics,false,editorSelectable);
      const options = {duration:source.duration*1000,iterations:source.loop?Infinity:1,fill:'both',easing:source.easing};
      const flips = source.keyframes[layout];
      if (orientation && flips.some(f=>f.flipX)) {
        const frames=flips.map(f=>({offset:f.offset,transform:`scaleX(${f.flipX?-1:1})`,easing:'steps(1,end)'}));
        orientation.animate(frames,options); speechCounter?.animate(frames,options);
        if(speechAnchor&&!speechAnchor.classList.contains('is-text-only')){
          const left=parseFloat(speechAnchor.style.left);
          if(left===0||left===100)speechAnchor.animate(flips.map(f=>({offset:f.offset,left:(f.flipX?100-left:left)+'%',easing:'steps(1,end)'})),options);
        }
      }
      node.dataset.sceneAnimationActive=String(animated || textAnimated); node.dataset.sceneAnimationType='channels';
      return animated || textAnimated;
    }
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
      if (speechCounter && keyframeSettings.keyframes.some(keyframe => keyframe.flipX)) speechCounter.animate(keyframeSettings.keyframes.map(keyframe => ({ offset:keyframe.offset, transform:'scaleX(' + (keyframe.flipX ? -1 : 1) + ')', easing:'steps(1, end)' })), options);
      if (speechAnchor && !speechAnchor.classList.contains('is-text-only') && keyframeSettings.keyframes.some(keyframe => keyframe.flipX)) {
        const left = parseFloat(speechAnchor.style.left);
        if (left === 0 || left === 100) speechAnchor.animate(keyframeSettings.keyframes.map(keyframe => ({ offset:keyframe.offset, left:(keyframe.flipX ? 100-left : left) + '%', easing:'steps(1, end)' })), options);
      }
      node.dataset.sceneAnimationActive = "true";
      node.dataset.sceneAnimationType = "keyframes";
      return true;
    }
    const settings = animationSettings(object);
    if (!playAnimation || !settings.enabled || prefersReducedMotion() || typeof node.animate !== "function") return Boolean(textAnimated);
    const requestedX = settings.position.x * metrics.width;
    const requestedY = settings.position.y * metrics.height;
    const travel = settings.mode === "seamless" ? seamlessTravel(node, metrics, requestedX, requestedY) : { x: requestedX, y: requestedY };
    const { x, y } = travel;
    if (!x && !y && !settings.rotation) return Boolean(textAnimated);
    if (settings.mode === "seamless" && orientation?.cloneNode && (x || y)) {
      const clone = orientation.cloneNode(true);
      clone.classList.add("is-seamless-clone");
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll?.("[id]")?.forEach?.((element) => element.removeAttribute("id"));
      clone.style.transform = `translate(${-x}px, ${-y}px)`;
      node.append(clone);
      if(canPlay)applyChannelAnimation(clone.querySelector?.('.scene-speech-bubble, .scene-render-object-text'),rules()?.normalizeTextBubble(object.textBubble).animation,layout,metrics,true,editorSelectable);
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

  function applySpeechStyle(node, object, layout) {
    const anchor = node.querySelector('.scene-speech-anchor');
    const settings = rules().normalizeTextBubble(object.textBubble);
    const placement = settings.layouts[layout];
    if (!anchor) {
      const text=node.querySelector('.scene-render-object-text');
      if(text)text.style.fontFamily=rules().fontFamily(settings.fontFamily);
      if(text&&settings.animation){text.style.position='relative';text.style.left=placement.x+'px';text.style.top=placement.y+'px';text.style.transform=`rotate(${placement.rotation}deg) scale(${placement.scale})`;}
      return;
    }
    const text = anchor.querySelector('.scene-speech-bubble');
    const hasMedia = Boolean(node.querySelector('.scene-render-object-media'));
    anchor.classList.toggle('is-text-only', !hasMedia);
    const anchors = { above:['50%','0%','-50%','calc(-100% - 16px)'],below:['50%','100%','-50%','16px'],left:['0%','50%','calc(-100% - 16px)','-50%'],right:['100%','50%','16px','-50%'],center:['50%','50%','-50%','-50%'] };
    let [left,top,tx,ty] = anchors[placement.anchor];
    if (object.flipX) left = (100 - parseFloat(left)) + '%';
    if (object.flipY) top = (100 - parseFloat(top)) + '%';
    anchor.style.left = hasMedia ? left : '0'; anchor.style.top = hasMedia ? top : '0';
    const inverse = hasMedia ? 1 / rules().scale(object,layout) : 1;
    anchor.style.transform = 'scale(' + inverse * (object.flipX ? -1 : 1) + ',' + inverse * (object.flipY ? -1 : 1) + ')';
    text.style.left = placement.x + 'px'; text.style.top = placement.y + 'px';
    text.style.transform = (hasMedia ? 'translate(' + tx + ',' + ty + ') ' : '') + 'rotate(' + placement.rotation + 'deg) scale(' + placement.scale + ')';
    text.style.fontFamily = rules().fontFamily(settings.fontFamily);
    text.style.color = settings.color; text.style.backgroundColor = settings.backgroundColor;
    text.style.fontSize = placement.fontSize + 'px'; text.style.fontWeight = settings.fontWeight;
    text.style.borderRadius = settings.radius + 'px'; text.style.maxWidth = placement.maxWidth + 'px';
  }
  function createObjectNode({ documentRef, object, scene, layout, surfaceScale, surfaceMetricsValue, resolveMediaSource, objectAttributes, onMediaError, playAnimation, editorSelectable }) {
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
    const speech = rules().normalizeTextBubble(object.textBubble);
    const hasText = Boolean(object?.text) || Boolean(object?.textDisplay && rules().normalizeTextDisplay(object.textDisplay).source !== "manual");
    if ((!speech.enabled || !hasText) && (hasText || !media)) {
      const text = documentRef.createElement("span");
      text.className = "scene-render-object-text";
      text.textContent = object?.text || object?.name || "";
      visual.append(text);
    }
    if (speech.enabled && hasText) {
      const anchor = documentRef.createElement('div'); anchor.className = 'scene-speech-anchor';
      const counter = documentRef.createElement('div'); counter.className = 'scene-speech-counterflip';
      const text = documentRef.createElement('span'); text.className = 'scene-speech-bubble'; text.textContent = object.text;
      counter.append(text); anchor.append(counter); visual.append(anchor);
    }
    const orientation = documentRef.createElement("div");
    orientation.className = "scene-render-object-orientation";
    orientation.append(visual);
    node.append(orientation);
    applyObjectStyle(node, object, layout, surfaceScale);
    applySpeechStyle(node, object, layout);
    const metrics = { width: surfaceMetricsValue.width, height: surfaceMetricsValue.height };
    applyObjectAnimation(node, object, metrics, playAnimation !== false, layout, editorSelectable);
    if(object.textDisplay){
      if(!global.ShiGaiSceneText)throw new Error('ShiGaiSceneText is required for information text.');
      node.querySelectorAll('.scene-speech-bubble, .scene-render-object-text').forEach(text=>global.ShiGaiSceneText.mount({node:text,wrapper:node,object,scene,layout,editorSelectable:!!editorSelectable}));
    }
    if (media && animationSettings(object).mode === "seamless") {
      const refreshSeamlessBounds = () => applyObjectAnimation(node, object, metrics, playAnimation !== false, layout);
      media.addEventListener(media.tagName === "VIDEO" ? "loadedmetadata" : "load", refreshSeamlessBounds, { once: true });
      if ((media.tagName === "VIDEO" && media.readyState >= 1) || (media.tagName !== "VIDEO" && media.complete)) global?.queueMicrotask?.(refreshSeamlessBounds);
    }
    return node;
  }

  function alignAuthoredSpeech(container) {
    for(const bubble of container.querySelectorAll('.scene-speech-bubble:not(.scene-info-text)')){
      if(bubble.dataset.dialoguePage)continue;
      const style=global.getComputedStyle?.(bubble);if(!style)continue;
      const line=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.45;
      const height=bubble.clientHeight-(parseFloat(style.paddingTop)||0)-(parseFloat(style.paddingBottom)||0);
      bubble.style.textAlign=height>line*1.6?'start':'center';
    }
  }

  // Measure with the same font and canonical width as the live bubble. Never
  // shrink author type or slice UTF-16 code units to fit a dialogue page.
  function mountEventDialogue(node, event, fullText, layout, frame) {
    const bubble=node.querySelector('.scene-speech-bubble, .scene-render-object-text');
    if(!bubble)return {};
    const doc=bubble.ownerDocument, probe=bubble.cloneNode(false);
    const width=parseFloat(bubble.style.maxWidth)||480;
    const scale=Math.max(.1,Math.abs(parseFloat((bubble.style.transform.match(/scale\(([^)]+)\)/)||[])[1])||1));
    bubble.style.maxWidth=Math.min(width,frame.width*.85/scale)+'px';
    bubble.style.whiteSpace='pre-wrap';bubble.style.overflowWrap='anywhere';bubble.style.lineBreak='strict';bubble.style.textWrap='pretty';
    probe.className='scene-dialogue-probe';probe.removeAttribute('id');
    probe.style.cssText=bubble.style.cssText;
    Object.assign(probe.style,{position:'fixed',left:'0',top:'0',transform:'none',visibility:'hidden',pointerEvents:'none',width:bubble.style.maxWidth,maxWidth:bubble.style.maxWidth,height:'auto',minHeight:'0',maxHeight:'none',overflow:'visible',animation:'none',transition:'none'});
    const computed=global.getComputedStyle(bubble);
    for(const key of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','paddingTop','paddingBottom','paddingLeft','paddingRight','borderTopWidth','borderBottomWidth','borderLeftWidth','borderRightWidth','boxSizing'])probe.style[key]=computed[key];
    doc.body.append(probe);
    const number=value=>parseFloat(value)||0, lineHeight=number(computed.lineHeight)||number(computed.fontSize)*1.45;
    const extra=number(computed.paddingTop)+number(computed.paddingBottom)+number(computed.borderTopWidth)+number(computed.borderBottomWidth);
    const limit=lineHeight*Math.max(1,Math.min(6,event.pageLines||3))+extra+1;
    const segments=global.Intl?.Segmenter?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(fullText),part=>part.segment):Array.from(fullText);
    const pages=[];let offset=0;
    try{while(offset<segments.length){let low=1,high=segments.length-offset,best=1;
      while(low<=high){const mid=Math.floor((low+high)/2);probe.textContent=segments.slice(offset,offset+mid).join('');if(probe.getBoundingClientRect().height<=limit){best=mid;low=mid+1;}else high=mid-1;}
      if(offset+best<segments.length){const candidate=segments.slice(offset,offset+best).join('');const boundary=[...candidate.matchAll(/[。！？!?；;，,、\n\s]/gu)].at(-1);if(boundary&&boundary.index>=candidate.length*.65){const prefix=candidate.slice(0,boundary.index+boundary[0].length);best=global.Intl?.Segmenter?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(prefix)).length:Array.from(prefix).length;}}
      pages.push(segments.slice(offset,offset+best).join(''));offset+=best;
    }}finally{probe.remove();}
    if(!pages.length)pages.push('');if(pages.length>1)bubble.style.width=bubble.style.maxWidth;
    let index=0;const content=doc.createElement('span'),counter=doc.createElement('small');content.className='scene-dialogue-content';counter.className='scene-dialogue-page';bubble.replaceChildren(content);if(pages.length>1)bubble.append(counter);
    function draw(){content.textContent=pages[index];counter.textContent=(index+1)+' / '+pages.length+(index<pages.length-1?' · 點一下繼續':'');bubble.dataset.dialoguePage=String(index+1);bubble.dataset.dialoguePages=String(pages.length);bubble.setAttribute('aria-label',pages[index]+(pages.length>1?'，第'+(index+1)+'頁，共'+pages.length+'頁':''));
      bubble.style.textAlign=content.offsetHeight>lineHeight*1.6?'start':'center';
    }
    draw();
    return {hasNextPage:()=>index<pages.length-1,nextPage:()=>{if(index>=pages.length-1)return false;index++;draw();return true;},readingSeconds:()=>event.readingTime===false?0:Math.min(120,Array.from(pages[index]).length/6+.5)};
  }

  function renderScene(options = {}) {
    if(options.container){eventControllers.get(options.container)?.destroy();eventControllers.delete(options.container);}
    const renderRules = rules();
    const { container, scene } = options;
    if (!renderRules) throw new Error("ShiGaiSceneRender is required.");
    if (!container || typeof container.replaceChildren !== "function") throw new TypeError("A Scene container is required.");
    const documentRef = container.ownerDocument || global.document;
    const layout = renderRules.isSharedComposition(scene) ? "landscape" : renderRules.layoutName(options.layout);
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
    alignAuthoredSpeech(container);
    container.dataset.sceneRenderer = UNIFIED;
    container.dataset.sceneId = String(scene?.id || "");
    container.dataset.sceneComposition = renderRules.isSharedComposition(scene) ? "shared-landscape-v1" : "legacy";
    container.dataset.sceneLayout = layout;
    container.dataset.sceneFitMode = metrics.fitMode;
    container.dataset.sceneViewportScale = String(surfaceScale);
    container.dataset.sceneFrameWidthMultiplier = String(metrics.frame.width / referenceFrames[layout].width);
    if (options.applyBackground !== false && scene?.background?.color) container.style.background = scene.background.color;
    if (!options.editorSelectable && options.enableLivingEvents !== false && scene?.livingEvents?.length && global.ShiGaiLivingEvents) {
      const controller = global.ShiGaiLivingEvents.mount({container,scene,preview:options.livingPreview===true,suppressAuto:options.livingPreview===true&&options.livingSuppressAuto!==false,...(options.livingCanStart?{canStart:options.livingCanStart}:{}),...(options.livingNow?{now:options.livingNow}:{}),replace(actor,event,text){
        const original=getObjectNode(container,actor.id);if(!original)return null;
        const mediaObject=scene.objects.find(o=>o.id===event.mediaObjectId);
        // The event owns its dialogue lifetime. Preserve the authored text transform
        // tracks, but do not let the original text's fade/hit track hide this reply.
        const bubble=rules().normalizeTextBubble(actor.textBubble);
        const eventBubble={...bubble,enabled:true,...(bubble.animation?{animation:{...bubble.animation,channels:Object.fromEntries(Object.entries(bubble.animation.channels||{}).map(([name,channels])=>[name,{...channels,...(channels.opacity?{opacity:{...channels.opacity,enabled:false}}:{})}]))}}:{})};
        const changed={...actor,text,textDisplay:undefined,textBubble:eventBubble,...(mediaObject?.media?.src?{media:mediaObject.media}:{})};
        const animations=original.getAnimations?.({subtree:true}).filter(a=>a.playState==='running')||[];animations.forEach(a=>a.pause());
        const videos=Array.from(original.querySelectorAll('video')).filter(v=>!v.paused);videos.forEach(v=>v.pause());
        const replacement=createObjectNode({...options,resolveMediaSource:object=>typeof options.resolveMediaSource==='function'?options.resolveMediaSource(mediaObject?.media?.src?mediaObject:object):object.media?.src,documentRef,object:changed,scene,layout,surfaceScale,surfaceMetricsValue:metrics});replacement.dataset.livingEventId=event.id;if(event.clickPolicy!=='original-first'){replacement.tabIndex=0;replacement.setAttribute('role','button');replacement.setAttribute('data-living-event-target','');replacement.setAttribute('aria-label',text+'；點擊回應');}
        const liveText=replacement.querySelector('.scene-speech-bubble, .scene-render-object-text');if(liveText){liveText.setAttribute('role','status');liveText.setAttribute('aria-live','polite');}
        replacement.querySelector('.scene-render-object-media')?.addEventListener('error',()=>{if(replacement.isConnected)controller.finish();},{once:true});
        original.replaceWith(replacement);
        const dialogue=mountEventDialogue(replacement,event,String(text||''),layout,metrics.frame);
        const restore=()=>{replacement.querySelectorAll('video').forEach(v=>v.pause());const focused=replacement.contains(documentRef.activeElement);replacement.replaceWith(original);animations.forEach(a=>a.play());videos.forEach(v=>v.play().catch(()=>{}));if(actor.textDisplay)original.querySelectorAll('.scene-speech-bubble, .scene-render-object-text').forEach(node=>global.ShiGaiSceneText?.mount({node,wrapper:original,object:actor,scene,layout}));if(focused)original.focus({preventScroll:true});};
        return Object.assign(restore,dialogue);
      }});
      eventControllers.set(container,controller);
    }
    return Object.freeze({ mode: UNIFIED, rendered: true, layout, fitMode: metrics.fitMode, objectCount: objects.length, viewportScale: surfaceScale, referenceFrame: metrics.frame, surfaceWidth: metrics.width, surfaceHeight: metrics.height });
  }

  function getObjectNode(container, objectId) {
    return Array.from(container?.querySelectorAll?.("[data-scene-object-id]") || []).find((node) => node.dataset.sceneObjectId === String(objectId)) || null;
  }

  function updateObject({ container, object, layout = "landscape", fitMode: requestedFitMode, playAnimation = true } = {}) {
    const node = getObjectNode(container, object?.id);
    if (!node) return Object.freeze({ mode: UNIFIED, updated: false, reason: "object-not-found" });
    const normalizedLayout = container?.dataset?.sceneComposition === "shared-landscape-v1" ? "landscape" : rules().layoutName(layout);
    const metrics = surfaceMetrics(container, normalizedLayout, requestedFitMode || container?.dataset?.sceneFitMode, { widthMultiplier: container?.dataset?.sceneFrameWidthMultiplier });
    const plane = node.closest?.(".scene-render-plane");
    if (plane) { plane.style.width = `${metrics.width}px`; plane.style.height = `${metrics.height}px`; }
    applyObjectStyle(node, object, normalizedLayout, metrics.scale);
    applySpeechStyle(node, object, normalizedLayout);
    alignAuthoredSpeech(node);
    applyObjectAnimation(node, object, metrics, playAnimation, normalizedLayout);
    container.dataset.sceneViewportScale = String(metrics.scale);
    container.dataset.sceneFitMode = metrics.fitMode;
    return Object.freeze({ mode: UNIFIED, updated: true });
  }

  function resizeScene({ container, scene, layout = "landscape", fitMode: requestedFitMode, playAnimation = true } = {}) {
    if (!container || !scene) return Object.freeze({ mode: UNIFIED, resized: false, reason: "missing-container-or-scene" });
    const normalizedLayout = container?.dataset?.sceneComposition === "shared-landscape-v1" ? "landscape" : rules().layoutName(layout);
    const metrics = surfaceMetrics(container, normalizedLayout, requestedFitMode || container?.dataset?.sceneFitMode, { widthMultiplier: container?.dataset?.sceneFrameWidthMultiplier });
    if (!metrics.width || !metrics.height) return Object.freeze({ mode: UNIFIED, resized: false, reason: "zero-size-container" });
    const plane = container.querySelector?.(".scene-render-plane");
    if (plane) { plane.style.width = `${metrics.width}px`; plane.style.height = `${metrics.height}px`; }
    rules().sortVisibleObjects(scene).forEach((object) => updateObject({ container, object, layout: normalizedLayout, fitMode: metrics.fitMode, playAnimation }));
    container.dataset.sceneViewportScale = String(metrics.scale);
    container.dataset.sceneFitMode = metrics.fitMode;
    return Object.freeze({ mode: UNIFIED, resized: true, layout: normalizedLayout, fitMode: metrics.fitMode, viewportScale: metrics.scale });
  }

  const previewLivingEvent = (container,id) => eventControllers.get(container)?.preview(id) || false;
  const stopLivingEvent = container => eventControllers.get(container)?.destroy();
  const api = Object.freeze({ previewLivingEvent, stopLivingEvent, UNIFIED, referenceFrames, mode, enabled, fitMode, surfaceMetrics, viewportScale, mappedTransform, animationSettings, keyframeAnimationSettings, applyObjectAnimation, renderScene, updateObject, resizeScene, getObjectNode });
  if (global) global.ShiGaiSceneRenderer = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
