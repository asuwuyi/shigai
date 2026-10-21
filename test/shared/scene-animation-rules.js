// Shared Scene Object animation schema. Normalization never mutates the source object.
(function exposeSceneAnimationRules(global) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  const round = (value) => Math.round(value * 1000) / 1000;
  const easing = (value) => value === "linear" ? "linear" : "ease-in-out";
  const properties = Object.freeze(["position", "scale", "rotation", "opacity"]);
  function normalizeChannelValue(property, value) {
    if (property === "position") return { x: round(clamp(value?.x, -960, 960, 0)), y: round(clamp(value?.y, -960, 960, 0)) };
    return round(property === "opacity" ? clamp(value, 0, 1, 1) : property === "scale" ? clamp(value, .05, 10, 1) : clamp(value, -720, 720, 0));
  }
  function normalizeChannels(value) {
    return Object.fromEntries(["landscape", "portrait"].map(layout => [layout, Object.fromEntries(properties.filter(p => value?.[layout]?.[p]).map(property => {
      const track = value[layout][property], frames = new Map();
      (Array.isArray(track.keyframes) ? track.keyframes : []).slice(0, 500).forEach(frame => {
        const offset = round(clamp(frame?.offset, 0, 1, 0));
        frames.set(offset, { offset, value: normalizeChannelValue(property, frame?.value) });
      });
      return [property, { enabled: track.enabled === true, keyframes: [...frames.values()].sort((a,b) => a.offset-b.offset) }];
    }))]));
  }

  function normalizeLegacy(source) {
    const legacyEnabled = source.type !== "keyframes" && Boolean(source.enabled || source.type === "loop");
    return {
      type: legacyEnabled ? "loop" : "",
      enabled: legacyEnabled,
      position: {
        x: round(clamp(source.position?.x, -10, 10, 0)),
        y: round(clamp(source.position?.y, -10, 10, 0))
      },
      rotation: round(clamp(source.rotation, -360, 360, 0)),
      duration: round(clamp(source.duration, .1, 120, 3)),
      mode: source.mode === "seamless" ? "seamless" : source.mode === "continuous" ? "continuous" : "yoyo",
      easing: easing(source.easing)
    };
  }

  function normalizeKeyframe(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      offset: round(clamp(source.offset, 0, 1, 0)),
      position: {
        x: round(clamp(source.position?.x, -10, 10, 0)),
        y: round(clamp(source.position?.y, -10, 10, 0))
      },
      rotation: round(clamp(source.rotation, -360, 360, 0)),
      scale: round(clamp(source.scale, .05, 5, 1)),
      flipX: Boolean(source.flipX)
    };
  }

  function normalizeKeyframeList(value) {
    if (!Array.isArray(value)) return [];
    const byOffset = new Map();
    value.forEach((item) => {
      const keyframe = normalizeKeyframe(item);
      byOffset.set(keyframe.offset, keyframe);
    });
    return [...byOffset.values()].sort((a, b) => a.offset - b.offset);
  }

  function normalizeKeyframes(source) {
    const landscape = normalizeKeyframeList(source.keyframes?.landscape);
    const portrait = normalizeKeyframeList(source.keyframes?.portrait);
    const channels = source.channels ? normalizeChannels(source.channels) : null;
    const hasPlayableLayout = landscape.length >= 2 || portrait.length >= 2 || channels && Object.values(channels).some(tracks => Object.values(tracks).some(track => track.enabled && track.keyframes.length));
    return {
      type: "keyframes",
      enabled: Boolean(source.enabled && hasPlayableLayout),
      duration: round(clamp(source.duration, .1, 120, 3)),
      loop: source.loop !== false,
      easing: easing(source.easing),
      keyframes: { landscape, portrait },
      ...(channels ? { channels } : {})
    };
  }

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    return source.type === "keyframes" ? normalizeKeyframes(source) : normalizeLegacy(source);
  }

  const isKeyframes = (value) => normalize(value).type === "keyframes";
  const keyframesForLayout = (value, layout) => {
    const animation = normalize(value);
    if (animation.type !== "keyframes") return [];
    return animation.keyframes[layout === "portrait" ? "portrait" : "landscape"];
  };

  const api = Object.freeze({ normalize, isKeyframes, keyframesForLayout, properties, normalizeChannels, normalizeChannelValue });
  if (global) global.ShiGaiSceneAnimation = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
