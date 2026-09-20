// Shared Scene Object animation schema. Normalization never mutates the source object.
(function exposeSceneAnimationRules(global) {
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  const round = (value) => Math.round(value * 1000) / 1000;
  const easing = (value) => value === "linear" ? "linear" : "ease-in-out";

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
    const hasPlayableLayout = landscape.length >= 2 || portrait.length >= 2;
    return {
      type: "keyframes",
      enabled: Boolean(source.enabled && hasPlayableLayout),
      duration: round(clamp(source.duration, .1, 120, 3)),
      loop: source.loop !== false,
      easing: easing(source.easing),
      keyframes: { landscape, portrait }
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

  const api = Object.freeze({ normalize, isKeyframes, keyframesForLayout });
  if (global) global.ShiGaiSceneAnimation = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
