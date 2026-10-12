# Claude Code への引き継ぎ指示書

polyline-partition の実装を、Windows 上の Claude Code に引き継ぐための指示書。仕様の検討と文書化は完了しており、ここからが実装フェーズである。

## 1. 最初に読むもの

次の順に読み、内容を踏まえてから作業を始める。

1. `CLAUDE.md`（`AGENTS.md` を取り込む）
2. `AGENTS.md`（作業ルール。特に 2 章の文章ルール、3 章の Git、4 章のコーディング規約、8 章の AI ツール）
3. `docs/spec.md`（アプリの仕様。特に 9 章の技術スタック・ディレクトリ構成・実装順序、10 章の決定事項）

仕様と規約に書かれていないことは、推測で決めずに質問する。仕様を変える場合は、先に `docs/spec.md` を更新する。

## 2. 現在の状態

- フォルダにあるのは、`AGENTS.md`、`CLAUDE.md`、`.mcp.json`、`.claude/`（スキル 2 つ、エージェント 2 つ）、`docs/spec.md`、この指示書のみ。
- アプリのコード、`package.json`、Git リポジトリはまだない。
- GitHub のリポジトリ名は `polyline-partition`。

## 3. 作業前の確認

作業を始める前に、次を確認し、足りないものはユーザーに伝える。

- Node.js が LTS か（`node -v`）
- pnpm が使えるか（`pnpm -v`。なければ corepack で有効化）
- `gh` CLI がログイン済みか（`gh auth status`）
- Svelte 公式 MCP が接続できるか（初回は `.mcp.json` のサーバーを承認する必要がある）
- `playwright-cli` を導入済みか（未導入なら `playwright-cli install --skills` を実行）

## 4. 作業の進め方

実装は `docs/spec.md` 9 章の順序に従い、手順ごとに次の流れで進める。

1. 手順の範囲と完了条件を、ユーザーに 3 行以内で伝える
2. 実装する。幾何処理はテストを先に書く（`write-tests` スキルを使う）
3. `pnpm check`、`pnpm lint`、`pnpm test` を通す（UI を変えたときは `pnpm test:e2e` も）
4. `code-reviewer` で差分をレビューし、必須の指摘を直す
5. `spec-checker` で仕様 ID との対応を確認し、抜けを直す
6. `commit` スキルでコミットする（1 コミット 1 目的）
7. 手順の結果を、事実と推論を分けて報告し、ユーザーの確認を待ってから次の手順へ進む

守ること。

- `--no-verify` でフックを回避しない。失敗したら原因を直す。
- 新しい依存を追加する前に、必要性を説明して承認を得る。ただし 5 章の承認済み一覧は除く。
- Svelte のコンポーネントを書いたら、確定前に `svelte-autofixer` で検査する。
- ドキュメンテーションコメントと日本語の文体は `AGENTS.md` 4.4 に従う。

## 5. 手順 1 の内容（最初の作業）

目的は、規約を機械的に強制できる空のプロジェクトを作ること。アプリの機能は作らない。

### 5.1 作る環境

| 項目 | 内容 |
| --- | --- |
| 雛形 | SvelteKit 3 と Svelte 5、TypeScript（strict）、pnpm。`sv create` の最小構成から始める |
| 静的サイト | `@sveltejs/adapter-static`。`src/routes/+layout.ts` に `prerender = true` |
| GitHub Pages | 環境変数 `BASE_PATH` を `vite.config.ts` の `sveltekit()` の `paths.base` に渡す（本番は `/polyline-partition`）。`static/.nojekyll` を置く |
| パスエイリアス | SvelteKit 3 は `$lib` ではなく `#lib`（`package.json` の `imports`）を使う。shadcn-svelte の alias も `#lib` で設定する |
| UI | shadcn-svelte を導入（Tailwind CSS v4、Bits UI、`components.json`、部品は `src/lib/components/ui`）。部品は必要になるまで追加しない |
| 単体テスト | Vitest。`passWithNoTests` に頼らず、日本語 3 階層の名前で書いた小さなテストを 1 件置く |
| E2E テスト | Playwright（Chromium のみ）。`e2e/` に起動確認の 1 件だけ置く |
| Lint と整形 | ESLint（typescript-eslint、eslint-plugin-jsdoc）、Prettier（prettier-plugin-svelte） |
| 型検査 | svelte-check |
| Git フック | husky、lint-staged、commitlint。割り当ては `AGENTS.md` 3.3 の表に従う |
| プロパティテスト | fast-check（導入のみ。使うのは手順 6） |
| 定数 | `src/lib/constants.ts`（ε の既定値と範囲、座標の上限、スナップの既定値と範囲を仕様書から転記） |
| CI | `.github/workflows/deploy.yml`。`pnpm check`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`、ビルド、`main` への push で GitHub Pages に配信 |

### 5.2 ESLint で強制するもの

`AGENTS.md` 4.7 のとおり。

- `@typescript-eslint/no-explicit-any`、`@typescript-eslint/no-non-null-assertion`
- `max-depth`（上限 3）、`@typescript-eslint/no-magic-numbers`（0、1、-1、2 は許可）
- `eslint-plugin-jsdoc` によるドキュメントコメントの必須化（クラス、関数、型、エクスポートする定数。メソッドとフィールドも対象にできる範囲で）

jsdoc プラグインでは「1 行目に句点なし」「〜かどうか禁止」は機械的に強制できない。強制できない規約は無理に作り込まず、`code-reviewer` で確認する。

### 5.3 スクリプト

`package.json` に次の名前でそろえる（`AGENTS.md` 6 章）。

`dev`、`build`、`preview`、`check`、`lint`、`format`、`test`、`test:e2e`

### 5.4 完了条件

次をすべて満たしたら手順 1 の完了とし、ユーザーに報告する。

- `pnpm check`、`pnpm lint`、`pnpm test`、`pnpm test:e2e`、`pnpm build` が通る
- `BASE_PATH=/polyline-partition pnpm build` の成果物で、ベースパスが正しく付いている
- 規約に違反するコミットメッセージ（例: `bad message`）が commitlint で拒否される
- 整形が崩れたファイルのコミットで、lint-staged が自動修正する
- 型エラーのある状態で `git push` すると、pre-push で止まる
- 手順 1 の内容が、1 目的ごとに分割されたコミットになっている
- `git init` と GitHub リポジトリの作成はユーザーの許可を得てから行い、`gh` CLI を使う

## 6. 承認済みの依存

次は追加してよい。これ以外はユーザーに相談する。

- 実行時: なし（幾何、面抽出、色付け、保存はすべて自前実装）
- UI: shadcn-svelte に伴う Tailwind CSS、Bits UI、`cn`（shadcn 公式のクラス結合ライブラリ）、`tailwind-variants` など CLI が追加するもの
- 開発時: `@sveltejs/adapter-static`、Vitest、Playwright、ESLint 一式、Prettier 一式、svelte-check、fast-check、husky、lint-staged、`@commitlint/cli`、`@commitlint/config-conventional`

バージョンはこの文書に固定せず、導入時点の安定版を使う。

## 7. 手順 2 以降の概要

詳細は `docs/spec.md` の 3〜8 章を正とする。

| 手順 | 内容 | 主な仕様 ID |
| --- | --- | --- |
| 2 | 幾何プリミティブと入力検証（テストを先に書く） | V-01〜V-06 |
| 3 | ノーディング | 7 章 |
| 4 | 頂点の併合 | 7 章 |
| 5 | 半辺構造と面列挙 | 7 章 |
| 6 | 分割パイプラインの統合とプロパティテスト | 7 章の検算 |
| 7 | UI（キャンバス、描画、編集、Undo / Redo） | FR、5 章 |
| 8 | 統計、色付け、JSON と SVG | FR、6 章 |
| 9 | E2E テスト | E2E-01〜E2E-19 |
| 10 | GitHub Pages へのデプロイ | 9 章 |

## 8. Claude Code に最初に渡すプロンプト

次をそのまま貼り付けて開始する。

```text
docs/handoff.md を読み、その指示に従って実装の手順1を進めてください。
最初に CLAUDE.md、AGENTS.md、docs/spec.md を読み、作業前の確認（handoff.md の3章）の結果を報告してください。
そのあと、手順1の範囲と完了条件を3行で伝えてから作業を始めてください。
```
