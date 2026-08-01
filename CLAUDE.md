# CLAUDE.md

`markado` は Bun + TypeScript の CLI。ローカル Markdown をブラウザでプレビューする。

## コマンド

```sh
bun run check   # check:version + typecheck + lint + format:check + test
bun run test
bun run build
bun run dev -- [flags] [path]
```

変更後は最低限 `bun run check` を通す。

`bun run` はプロジェクトルート探索で親ディレクトリを列挙するため、ホームディレクトリを読み取り拒否するサンドボックス下では起動に失敗する。その場合は各ツールを直接呼ぶ。

```sh
bun test
bun scripts/check-version.ts
./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/oxlint
./node_modules/.bin/oxfmt --check src test
```

## アーキテクチャ

```
src/
  cli.ts     引数パースと起動のみ
  core/      汎用 Markdown リーダー（フレーバ非依存）
  flavors/   フレーバ契約・registry・plain・ado/
  server/    ルーティング・SSE hub・MIME
  web/       ブラウザアセット（文字列リテラル。React 化は未着手）
```

### 守るべき境界

- **`core/` に特定 wiki の仕様を持ち込まない。** Azure DevOps Wiki 固有の挙動（`.order`、`Page.md` + `Page/`、`[[_TOC_]]`、`::: mermaid`、ルート絶対リンク）はすべて `flavors/ado/` にある。新しい wiki 方言を足すときも同様に `flavors/` 配下へ
- **フレーバのフックは全て optional。** 未指定なら `core` の既定にフォールバックする（`src/flavors/types.ts`）。`plain` フレーバがフック無しで成立していることが、この分離が守られている証拠
- **URL 形式を知ってよいのは `toHref` だけ**（`src/core/links.ts`）。レンダラもフレーバも `LinkTarget` を返し、HTML には `data-markado-*` を付ける。フロントエンドを差し替えても壊れないようにするため
- **Markdown は parse → 見出し ID 付与 → render の 1 パス**（`src/core/markdown.ts`）。トークン列を 2 回作ると TOC のアンカーと本文の `id` がずれる
- **構文拡張は文字列置換でなく markdown-it のルールとして書く。** 置換だとフェンス済みコードブロックの中身まで書き換えてしまう
- **パス安全性は字句チェックと symlink チェックが別**（`src/core/path.ts`）。`resolveSafePath` → 存在確認 → `assertRealPathWithinRoot` の順に呼ぶ。この順序が「ルート外は 400 / 存在しないだけなら 404」を成立させている

## 開発スタイル

- TDD。設定ファイル・ドキュメント・小規模修正は除く
- 静的に検査できるルールは oxlint / oxfmt / tsc に寄せる。コメントで補わない
- コードコメントは Why が非自明なときだけ。What は書かない
- `PostToolUse` フックが編集後に `oxfmt --write` を自動実行する（`.claude/settings.json`）

## テスト

`test/` は `src/` の構造に対応。`test/helpers/wiki.ts` の `createWiki()` で一時ディレクトリに wiki を組み立てる。

サーバー系は 3 層に分かれている。追加時はどの層に置くべきか確認する。

| ファイル                          | 対象                           | ソケット | ファイル監視           |
| --------------------------------- | ------------------------------ | -------- | ---------------------- |
| `test/server/handler.test.ts`     | ルーティング・ステータスコード | 不要     | 不要                   |
| `test/server/wiring.test.ts`      | watcher → hub → クライアント   | 不要     | 不要（watcher を注入） |
| `test/server/integration.test.ts` | 実 HTTP・実 chokidar           | **必要** | **必要**               |

`integration.test.ts` はソケットの listen とファイル監視が両方使える環境でしか通らない。サンドボックス内で失敗する場合、まず環境制約を疑う（`Bun.serve` が全ポートで `EADDRINUSE` になるなら listen が禁止されている）。

## リリース

`package.json` と `src/version.ts` の両方を更新する必要があり、`bun run check:version` が一致を検証する。`bun run version <x.y.z>` で両方を書き換える。
