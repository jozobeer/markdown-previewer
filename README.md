# Markdownプレビューア

左側にMarkdownテキストを入力すると右側にリアルタイムでレンダリング結果が表示される、静的単一ページのプレビューツール。ローカルストレージへの自動保存にも対応する。

## 公開URL

https://markdown-previewer.jozo.beer

## 開発

[kojo](https://github.com/jozobeer/kojo)（1日1アプリ自動生成基盤）により生成されたリポジトリです。

- `npm run verify` — 検証（実装の完成条件チェック）
- `npm run deploy` — Cloudflare Workers へデプロイ

## 構成

- `public/index.html` — アプリ本体（CSS/JSインラインの単一ファイル）
- `PLAN.md` — 受け入れ条件付きの実装計画
