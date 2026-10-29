(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShiGaiMemory = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function shuffle(input, random = Math.random) {
    const output = [...input];
    for (let i = output.length - 1; i > 0; i--) { const j = Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (i + 1)); [output[i], output[j]] = [output[j], output[i]]; }
    return output;
  }
  function validateLevel(level, available) {
    const { pairs, targetSeconds, targetMoves } = level || {};
    if (!Number.isInteger(pairs) || pairs < 2 || pairs > 18 || pairs > available || !Number.isInteger(targetSeconds) || targetSeconds < 5 || targetSeconds > 3600 || !Number.isInteger(targetMoves) || targetMoves < pairs || targetMoves > 1000) throw Error('關卡設定需為 2～18 對且素材足夠，時間 5～3600 秒、目標次數不低於配對數。');
    return { pairs, targetSeconds, targetMoves };
  }
  function stars(level, seconds, moves) {
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isInteger(moves) || moves < level.pairs) return 0;
    if (seconds <= level.targetSeconds && moves <= level.targetMoves) return 3;
    if (seconds <= level.targetSeconds * 1.5 && moves <= level.targetMoves * 1.5) return 2;
    return 1;
  }
  class Round {
    constructor(level, faceIds, random = Math.random) {
      if (!Array.isArray(faceIds) || new Set(faceIds).size !== faceIds.length) throw Error('卡面 ID 不可重複。');
      this.level = validateLevel(level, faceIds.length);
      const chosen = shuffle(faceIds, random).slice(0, level.pairs);
      this.cards = shuffle(chosen.flatMap(face => [{ face, open: false, matched: false }, { face, open: false, matched: false }]), random);
      this.status = 'ready'; this.first = -1; this.pending = []; this.moves = 0; this.matches = 0;
    }
    pick(index) {
      const card = this.cards[index];
      if (!card || card.open || card.matched || this.pending.length || this.status === 'won') return 'ignored';
      this.status = 'playing'; card.open = true;
      if (this.first === -1) { this.first = index; return 'first'; }
      const first = this.first; this.first = -1; this.moves++;
      if (this.cards[first].face === card.face) {
        card.matched = true; this.cards[first].matched = true; this.matches++;
        if (this.matches === this.level.pairs) this.status = 'won';
        return 'match';
      }
      this.pending = [first, index]; return 'mismatch';
    }
    settle() { for (const i of this.pending) this.cards[i].open = false; this.pending = []; }
  }
  return Object.freeze({ Round, shuffle, validateLevel, stars });
});
