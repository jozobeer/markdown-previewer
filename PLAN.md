# PLAN: Markdownプレビューア

## 1. 概要

左ペインの `<textarea>` に入力した Markdown を、右ペインへリアルタイムに HTML レンダリングする静的単一ページアプリ。外部ライブラリ・CDN・ビルドツールを使わないため、Markdown パーサは `public/index.html` 内にインライン実装した自前パーサで賄う。入力内容は debounce 付きで `localStorage` に自動保存し、リロード後も直前の編集内容が復元される。プレビューは `innerHTML` で描画するため、HTML エスケープを先に行ってからタグを生成する順序を守り、入力文字列がスクリプトとして実行されないようにする。

## 2. 受け入れ条件

- [ ] 左ペインの textarea に文字を入力すると、ボタン操作や外部通信なしに右ペインのプレビューが更新される（入力停止から 300ms 以内に反映される）
- [ ] 次の記法がそれぞれ対応する HTML 要素にレンダリングされる: 見出し `#`〜`######` → `h1`〜`h6` / 箇条書き `-`,`*` → `ul>li` / 番号付き `1.` → `ol>li` / `**太字**` → `strong` / `*斜体*` → `em` / `[text](url)` → `a[href]` / ` ```lang ` フェンス → `pre>code` / `` `code` `` → `code`
- [ ] 入力後にページをリロードすると、`localStorage` から直前の内容が復元され、textarea とプレビューの両方に反映される
- [ ] `<script>alert(1)</script>` や `<img onerror=...>` を入力してもスクリプトは実行されず、文字列としてそのまま表示される。フェンスドコードブロック内の Markdown 記法・HTML タグも解釈されず原文のまま表示される
- [ ] ビューポート幅 720px 以下で 2 ペインが 1 カラムに縦積みされ、フッターの `apps.jozo.beer` リンクが本文最下部に通常フローで表示される（横並びやはみ出しが起きない）
- [ ] `npm run verify` が終了コード 0 で `verify OK` を出力する

## 3. 実装方針

### ファイル構成

- `public/index.html` の単一ファイルのみ。CSS は `<style>`、JS は `<script>` でインライン。
- favicon は `<link rel="icon" href="data:image/svg+xml,...">` のインライン data URI。テーマに合わせ「文書＋下向き矢印（M↓ を想起させる形）」の SVG を使う。URL エンコード時は `#` を `%23` にすること（生の `#` は data URI のフラグメント扱いになり描画されない）。

### レイアウト

- `body { display: flex; flex-direction: column; min-height: 100vh; }`。`main` を 2 ペイン、`footer` を最下部に置く（AGENTS.md の指定どおり、centering flex の直下に footer を置いてレイアウトが崩れることを避ける）。
- `main { display: grid; grid-template-columns: 1fr 1fr; gap; }`。`@media (max-width: 720px)` で `grid-template-columns: 1fr` に切り替え。
- 各ペインは独立スクロール（`overflow: auto`）。textarea は `resize: none; width/height: 100%`、等幅フォント。
- 配色はダーク基調のエディタ風テーマ。`prefers-color-scheme` は必須ではないが、フッターリンク色は背景とのコントラストを確保する。

### Markdown パーサ（自前実装・2 段階）

処理順序が正しさの要。**必ず「エスケープ → ブロック解析 → インライン解析」の順**で行う。

1. `escapeHtml(s)` — `& < > "` を実体参照へ変換。パース開始前に全文へ適用し、以降の工程では自前で生成したタグ以外に `<` が現れない状態を保つ（これが XSS 対策の中核）。
2. `parseBlocks(src)` — 行単位の走査で以下を判定し HTML 文字列を組み立てる。
   - フェンスドコードブロック（``` ）: **最優先で判定**し、閉じフェンスまでの行は一切インライン解析せず `<pre><code>` にそのまま入れる。閉じフェンスが無い場合は末尾までをコードとして扱う。
   - 見出し `#{1,6} `、水平線 `---`/`***`、引用 `> `、箇条書き `- `/`* `、番号付き `1. `、空行による段落分割。
   - リストは連続行をまとめて 1 つの `ul`/`ol` に閉じる（開閉状態を変数で保持）。
3. `parseInline(s)` — 段落・見出し・リスト項目のテキストにのみ適用。
   - インラインコード `` ` `` を最初に抽出してプレースホルダへ退避 → 太字 `**` → 斜体 `*` → リンク `[t](u)` の順に置換 → 最後に退避したコードを `<code>` として戻す。この順序によりコード内の `*` が誤変換されるのを防ぐ。
   - リンクの `href` は `http:` `https:` `#` `/` `mailto:` 以外のスキーム（特に `javascript:`）を弾き、該当時はリンク化せず素のテキストにする。

### 主要関数

| 関数 | 役割 |
| --- | --- |
| `escapeHtml(s)` | HTML 特殊文字のエスケープ |
| `parseInline(s)` | コード/太字/斜体/リンクのインライン変換 |
| `parseBlocks(src)` | 行走査によるブロック変換（パーサ本体） |
| `renderMarkdown(src)` | `escapeHtml` → `parseBlocks` を束ねるエントリポイント |
| `render()` | textarea の値を `renderMarkdown` に通し `preview.innerHTML` へ反映 |
| `save()` | `localStorage.setItem(STORAGE_KEY, value)`（try/catch で保存失敗を無視） |
| `load()` | 起動時に復元。値が無ければサンプル Markdown を初期表示 |
| `debounce(fn, ms)` | 保存処理を 300ms デバウンス |

### 状態・イベント

- `STORAGE_KEY = 'markdown-previewer:draft'`。
- `textarea` の `input` イベントで `render()` を即時実行（体感の即時性を優先）、`save()` は debounce 経由。
- 初期化: `DOMContentLoaded` 相当のタイミング（`<script>` は `</body>` 直前）で `load()` → `render()`。
- 初期サンプルは見出し・リスト・太字・リンク・コードブロックを含め、受け入れ条件 2 の記法を初見で確認できるものにする。

### 検証手順

1. `public/index.html` をブラウザで開き、受け入れ条件 1〜5 を手動確認（特に XSS 入力とリロード復元）。
2. `npm run verify` を実行し `verify OK` を確認する。
