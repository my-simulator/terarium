# Moss Studio（テラリウムシミュレーター）v2

3D空間でガラス容器に土・石・流木・苔・植物を配置して、コケテラリウムを設計するWebアプリ。
外部サーバー・CDN不要（Three.js r187 を同梱）。

## 動かし方
ES Modules を使うため、ファイルを直接ダブルクリックでは動きません。
- GitHub Pages：このフォルダをそのまま公開
- PCで確認：このフォルダで `python3 -m http.server` → http://localhost:8000

## フォルダ構成
```
index.html            画面の骨組み（import map で three を読み込み）
css/app.css           見た目
js/app.js             状態・操作（actions）・画面切り替え
js/core/util.js       数値・乱数・ノイズ
js/core/terrain.js    容器の内寸、土の地形（高さデータ・ブラシ・土量計算）
js/data/catalog.js    素材カタログ（素材を増やすときはここ）
js/data/model.js      作品データ形式（version付き）と旧データ移行
js/data/storage.js    端末内保存・JSON読み書き
js/render/stage.js    レンダラー・カメラ・ライト・視点
js/render/builders.js 容器・土・石・流木・苔・植物の3D生成
js/render/sync.js     作品データ→3Dの反映（変更分だけ作り直し）
js/render/textures.js 手続き的テクスチャ
js/render/thumbs.js   素材サムネイル
js/edit/interaction.js 3D上の選択・移動・積み重ね・地形ブラシ
js/edit/history.js    元に戻す・やり直し
js/ui/views.js        画面・パネルのHTML
js/vendor/            Three.js（MITライセンス）
```

## 素材を追加するには
1. `js/data/catalog.js` の `MATERIALS` に1件追加（cat / type / size / color / edit など）
2. 新しいカテゴリなら `js/render/builders.js` の `BUILDERS` に生成関数を登録
3. 将来GLBモデルを使う場合は `model` にパスを入れ、`buildItem` に読み込み分岐を追加

## データ形式（version 2）
- 座標：x=左右、y=上（容器の底=0）、z=前後。単位cm
- `items`：オブジェクト配置型の素材（位置・回転・傾き・大きさ・埋め込み・色・接地状態・表示）
- `terrain`：高さデータ（n×n）＋ポイント
- `brushLayers` / `environment`：将来の砂・砂利・苔ブラシ／水・滝用に予約
- 旧2D版（v1）の保存データは自動で引き継ぎ
