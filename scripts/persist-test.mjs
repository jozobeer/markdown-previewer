// L1 永続化検証シナリオ。kojo の persistGate が chromium 上で実行する:
//   1. scenario(page) — アプリを操作し、localStorage に保存されるべき状態を作る
//   2. （kojo 側が page.reload() する）
//   3. verify(page) — リロード後の復元状態を検証する。不一致なら throw すること
// page は Playwright の Page。セレクタはこのアプリの実装に合わせて書き換える。
// このファイルはレベル制約で指示された場合のみ書き換える（L0 では実行されない）

export async function scenario(page) {
  throw new Error("builder が scenario をこのアプリ固有の操作に書き換えてください");
}

export async function verify(page) {
  throw new Error("builder が verify をこのアプリ固有の検証に書き換えてください");
}
