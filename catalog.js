// 素材カタログ
// 素材を増やすときはここに1件追加し、render/builders.js の BUILDERS に生成関数を登録する。
// method: 'object'（オブジェクト配置） / 'brush'（ブラシ・地形編集：将来の砂・砂利など） / 'env'（環境：将来の水・滝など）
// model: 将来 GLB / glTF モデルに差し替える場合のファイルパス（null の間は自動生成）

export const CONTAINERS = {
  cylinder: { name: '円筒型', def: { w: 12, d: 12, h: 15, mouth: 12 } },
  bowl: { name: 'ボウル型', def: { w: 16, d: 16, h: 14, mouth: 10 } },
  box: { name: '角型', def: { w: 20, d: 12, h: 15, mouth: 20 } },
};

export const SOILS = {
  akadama: { name: '赤玉土', rgb: [154, 96, 56], grain: true },
  kuro: { name: '黒土', rgb: [66, 50, 39], grain: false },
};

// 素材追加パネルのカテゴリ（setting は容器・土の設定パネル）
export const CATEGORIES = [
  { id: 'container', label: '容器', kind: 'setting' },
  { id: 'soil', label: '土', kind: 'setting' },
  { id: 'stone', label: '石', kind: 'material' },
  { id: 'wood', label: '流木', kind: 'material' },
  { id: 'moss', label: '苔', kind: 'material' },
  { id: 'plant', label: '植物', kind: 'material' },
  // 将来：sand（砂）, gravel（砂利）, water（水）, deco（装飾品）, creature（生き物）
];

// 編集項目のキー: pos=X/Z位置, y=高さ位置, rot=回転, tilt=傾き, scale=大きさ, dims=幅・奥行き・高さ, sink=埋め込み, color=色
const SOLID = ['pos', 'y', 'rot', 'tilt', 'scale', 'dims', 'sink', 'color'];
const MOSS = ['pos', 'rot', 'scale', 'dims', 'color'];
const PLANT = ['pos', 'y', 'rot', 'tilt', 'scale', 'sink'];

export const MATERIALS = {
  'stone.lava': { cat: 'stone', type: 'lava', name: '溶岩石', method: 'object', size: { w: 5, d: 4, h: 3.5 }, sink: 0.15, color: '#5b3b31', colors: ['#5b3b31', '#3b3230', '#7a4a38', '#2e2a28'], solid: true, edit: SOLID, note: '多孔質で苔が活着しやすい', model: null },
  'stone.seika': { cat: 'stone', type: 'seika', name: '青華石', method: 'object', size: { w: 5, d: 3.5, h: 5.5 }, sink: 0.12, color: '#6c7a80', colors: ['#6c7a80', '#5a646a', '#7f8a86', '#4d5a62'], solid: true, edit: SOLID, note: '縦の層が美しい山岳風', model: null },
  'stone.river': { cat: 'stone', type: 'river', name: '川石', method: 'object', size: { w: 4, d: 3, h: 2 }, sink: 0.2, color: '#9c968b', colors: ['#9c968b', '#7d7a74', '#b3a994', '#6a6e70'], solid: true, edit: SOLID, note: '丸みのある落ち着いた石', model: null },
  'stone.mokka': { cat: 'stone', type: 'mokka', name: '木化石', method: 'object', size: { w: 3.5, d: 3, h: 5 }, sink: 0.12, color: '#8a7358', colors: ['#8a7358', '#a08868', '#6e5d4a', '#9a7a5a'], solid: true, edit: SOLID, note: '木目のような縦筋', model: null },
  'wood.branch': { cat: 'wood', type: 'branch', name: '枝流木', method: 'object', size: { w: 9, d: 3, h: 3 }, sink: 0.05, color: '#7a5c40', colors: ['#7a5c40', '#5e4632', '#9a8066', '#b5a58e'], solid: true, edit: SOLID, note: '細く伸びる枝', model: null },
  'wood.root': { cat: 'wood', type: 'root', name: '根流木', method: 'object', size: { w: 7, d: 5, h: 4.5 }, sink: 0.05, color: '#644a32', colors: ['#644a32', '#4a3828', '#86684a', '#a8977e'], solid: true, edit: SOLID, note: '力強い根張り', model: null },
  'moss.hosoba': { cat: 'moss', type: 'hosoba', name: 'ホソバオキナゴケ', method: 'object', size: { w: 4, d: 4, h: 1.6 }, sink: 0, color: '#93ab7c', colors: ['#93ab7c', '#7f9a6c', '#a9bb92'], solid: false, edit: MOSS, note: 'こんもり丸いクッション', model: null },
  'moss.shinobu': { cat: 'moss', type: 'shinobu', name: 'シノブゴケ', method: 'object', size: { w: 5, d: 4.5, h: 0.7 }, sink: 0, color: '#5e7d39', colors: ['#5e7d39', '#4d6a2f', '#728f45'], solid: false, edit: MOSS, note: '羽状に広がる濃い緑', model: null },
  'moss.hai': { cat: 'moss', type: 'hai', name: 'ハイゴケ', method: 'object', size: { w: 6, d: 5, h: 0.5 }, sink: 0, color: '#8e9a3f', colors: ['#8e9a3f', '#7a8a3a', '#a4a84a'], solid: false, edit: MOSS, note: '這うように広がる黄緑', model: null },
  'moss.tama': { cat: 'moss', type: 'tama', name: 'タマゴケ', method: 'object', size: { w: 3.5, d: 3.5, h: 1.8 }, sink: 0, color: '#a6c463', colors: ['#a6c463', '#93b456', '#b8d070'], solid: false, edit: MOSS, note: '明るい緑と丸い胞子体', model: null },
  'plant.fern': { cat: 'plant', type: 'fern', name: 'ヒメタマシダ', method: 'object', size: { w: 7, d: 7, h: 8 }, sink: 0, color: '#4f7b35', colors: [], solid: false, edit: PLANT, note: '小型のシダ', model: null },
  'plant.fittonia': { cat: 'plant', type: 'fittonia', name: 'フィットニア', method: 'object', size: { w: 5, d: 5, h: 5 }, sink: 0, color: '#4f7f3c', colors: [], solid: false, edit: PLANT, note: '葉脈が白い小型観葉', model: null },
};

export const matsOf = cat => Object.entries(MATERIALS).filter(([, m]) => m.cat === cat);
export const catLabel = id => (CATEGORIES.find(c => c.id === id) || {}).label || id;
