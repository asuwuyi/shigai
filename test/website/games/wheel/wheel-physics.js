// Deterministic rotational motion; inputs supply momentum, never a chosen result.
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const wrap = angle => ((angle % TAU) + TAU) % TAU;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function selectedIndex(angle, pointerAngle, count) {
    if (!Number.isInteger(count) || count < 2) throw Error('至少需要兩個選項。');
    return Math.min(count - 1, Math.floor(wrap(pointerAngle - angle + Math.PI / 2) / TAU * count));
  }
  function normalizeOptions(input) {
    const list = typeof input === 'string' ? input.split(/\r?\n/) : input;
    if (!Array.isArray(list) || list.some(x => typeof x !== 'string')) throw Error('請每行輸入一個選項。');
    const options = list.map(s => s.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 24) throw Error('請輸入 2～24 個選項。');
    if (options.some(s => Array.from(s).length > 80)) throw Error('每個選項最多 80 字，請縮短後再套用。');
    return options;
  }
  class Rotor {
    constructor() { this.angle = 0; this.omega = 0; this.mode = 'idle'; this.braking = false; }
    hold() { this.mode = 'hold'; this.braking = false; this.driveDirection=Math.sign(this.omega)||1; this.omega=this.driveDirection*Math.max(.65,Math.abs(this.omega)); }
    release() { this.mode = Math.abs(this.omega) > 0 ? 'coast' : 'idle'; }
    grab() { this.mode = 'drag'; this.omega = 0; this.braking = false; }
    drag(delta, velocity) { this.angle = wrap(this.angle + delta); this.omega = clamp(velocity, -24, 24); }
    brake() { this.braking = true; this.release(); }
    step(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.mode === 'idle' || this.mode === 'drag') return;
      if (this.mode === 'hold') {
        const direction=this.driveDirection||1,speed=Math.abs(this.omega),acceleration=7,max=24,reach=Math.max(0,(max-speed)/acceleration),t=Math.min(dt,reach);
        this.angle=wrap(this.angle+direction*(speed*t+.5*acceleration*t*t+max*(dt-t)));
        this.omega=direction*Math.min(max,speed+acceleration*dt);return;
      }
      const k = this.braking ? 1.9 : .62, c = .16, sign = Math.sign(this.omega), speed = Math.abs(this.omega);
      const stopTime = Math.log1p(k * speed / c) / k, t = Math.min(dt, stopTime);
      this.angle = wrap(this.angle + sign * ((speed + c / k) * (-Math.expm1(-k * t)) / k - c / k * t));
      this.omega = dt >= stopTime ? 0 : sign * ((speed + c / k) * Math.exp(-k * t) - c / k);
      if (this.omega === 0) this.mode = 'idle';
    }
  }
  const api = { TAU, wrap, selectedIndex, normalizeOptions, Rotor };
  root.ShiGaiWheelPhysics = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
