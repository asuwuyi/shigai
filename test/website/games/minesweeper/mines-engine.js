(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ShiGaiMines = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function validateLevel(level) {
    const { rows, cols, mines } = level || {};
    if (![rows, cols, mines].every(Number.isInteger) || rows < 5 || rows > 24 || cols < 5 || cols > 30 || mines < 1 || mines > Math.floor(rows * cols * .3) || mines > rows * cols - 9) throw Error('關卡需為 5～24 列、5～30 欄，地雷不超過 30%。');
    return { rows, cols, mines };
  }
  class Board {
    constructor(level, random = Math.random) {
      Object.assign(this, validateLevel(level)); this.random = random;
      this.cells = Array.from({ length: this.rows * this.cols }, () => ({ mine: false, count: 0, open: false, flag: false }));
      this.status = 'ready'; this.opened = 0; this.flags = 0; this.exploded = -1;
    }
    neighbors(index) {
      const row = Math.floor(index / this.cols), col = index % this.cols, result = [];
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if ((x || y) && row + y >= 0 && row + y < this.rows && col + x >= 0 && col + x < this.cols) result.push((row + y) * this.cols + col + x);
      return result;
    }
    plant(first) {
      const safe = new Set([first, ...this.neighbors(first)]), candidates = this.cells.map((_, i) => i).filter(i => !safe.has(i));
      for (let i = 0; i < this.mines; i++) {
        const unit = Math.max(0, Math.min(1 - Number.EPSILON, this.random()));
        const j = i + Math.floor(unit * (candidates.length - i));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; this.cells[candidates[i]].mine = true;
      }
      this.cells.forEach((cell, i) => { cell.count = this.neighbors(i).filter(n => this.cells[n].mine).length; }); this.status = 'playing';
    }
    toggleFlag(index) {
      const cell = this.cells[index]; if (!cell || cell.open || ['won', 'lost'].includes(this.status)) return false;
      cell.flag = !cell.flag; this.flags += cell.flag ? 1 : -1; return true;
    }
    reveal(index) {
      const cell = this.cells[index]; if (!cell || cell.open || cell.flag || ['won', 'lost'].includes(this.status)) return false;
      if (this.status === 'ready') this.plant(index);
      if (cell.mine) { cell.open = true; this.exploded = index; this.status = 'lost'; return true; }
      const queue = [index];
      while (queue.length) {
        const i = queue.pop(), c = this.cells[i]; if (c.open || c.flag || c.mine) continue;
        c.open = true; this.opened++;
        if (c.count === 0) queue.push(...this.neighbors(i).filter(n => !this.cells[n].open));
      }
      if (this.opened === this.cells.length - this.mines) {
        this.status = 'won'; this.cells.forEach(c => { if (c.mine) c.flag = true; }); this.flags = this.mines;
      }
      return true;
    }
    chord(index) {
      const cell = this.cells[index]; if (!cell?.open || !cell.count || this.status !== 'playing') return false;
      const neighbors = this.neighbors(index); if (neighbors.filter(i => this.cells[i].flag).length !== cell.count) return false;
      let changed = false;
      for (const i of neighbors) { changed = this.reveal(i) || changed; if (['lost', 'won'].includes(this.status)) break; }
      return changed;
    }
  }
  return Object.freeze({ Board, validateLevel });
});
