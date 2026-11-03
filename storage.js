// 端末内保存（localStorage）と JSON 読み書き
import { migrate, cloneForSave, newWork } from './model.js';
import { uid } from '../core/util.js';

const KEY = 'moss-studio-v2', OLD_KEY = 'moss-studio-v1';

export function loadDB() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.works)) { d.works = d.works.map(migrate).filter(Boolean); return d; }
    const o = JSON.parse(localStorage.getItem(OLD_KEY)); // 旧2D版のデータを引き継ぐ
    if (o && Array.isArray(o.works)) return { works: o.works.map(migrate).filter(Boolean) };
  } catch (e) { /* 保存領域が使えない環境 */ }
  return { works: [] };
}
export function saveDB(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
}
export const exportJSON = w => JSON.stringify(cloneForSave(w));
export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || !o.container || !o.terrain) throw new Error('形式が違います');
  const w = migrate(o.version >= 2 ? Object.assign(newWork(o.container.type), o) : o);
  w.id = uid(); w.created = w.updated = Date.now(); w.name = o.name || '読み込んだ作品';
  return w;
}
