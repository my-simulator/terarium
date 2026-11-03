// 元に戻す・やり直し（作品データのスナップショット）
export class History {
  constructor(limit = 80) { this.limit = limit; this.undoStack = []; this.redoStack = []; this.last = null; }
  static snap(w) { return JSON.stringify({ container: w.container, soil: w.soil, terrain: w.terrain, items: w.items, brushLayers: w.brushLayers, environment: w.environment }); }
  reset(w) { this.undoStack = []; this.redoStack = []; this.last = History.snap(w); }
  commit(w) {
    const s = History.snap(w); if (s === this.last) return false;
    this.undoStack.push(this.last); if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = []; this.last = s; return true;
  }
  undo() { if (!this.undoStack.length) return null; this.redoStack.push(this.last); this.last = this.undoStack.pop(); return JSON.parse(this.last); }
  redo() { if (!this.redoStack.length) return null; this.undoStack.push(this.last); this.last = this.redoStack.pop(); return JSON.parse(this.last); }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
