# 手順2 への引き継ぎ指示書

手順1（環境構築）は完了した。この文書は、新しい Claude Code セッションが手順2（幾何プリミティブと入力検証）から作業を再開するための指示書である。`docs/handoff.md` の 4 章（作業の進め方）と 6 章（承認済みの依存）は引き続き有効で、この文書はその差分と現状だけを書く。

## 1. 最初に読むもの

1. `CLAUDE.md`（`AGENTS.md` を取り込む）
2. `docs/spec.md`（特に 4 章の V-01〜V-06、7 章、8 章のテスト方針）
3. この文書

## 2. 現在の状態

- 手順1は完了し、GitHub（`rinjugatla/polyline-partition`、public）へ push 済み。Pages の Source は「GitHub Actions」で、`https://rinjugatla.github.io/polyline-partition/` が公開されている。
- 最新コミットは `19bad1d`（レビュー指摘の反映）。このコミットは未 push の可能性がある。`git status` と `git log origin/main..` で確認する。
- 採用フレームワークは SvelteKit 3（2 ではない）。`svelte.config.js` は存在せず、設定は `vite.config.ts` の `sveltekit()` に渡す。パスエイリアスは `$lib` ではなく `#lib`（`package.json` の `imports`）。
- 手順1で通ることを確認済み: `pnpm check`、`pnpm lint`、`pnpm test`（3件）、`pnpm test:e2e`（3件）、`pnpm build`、`BASE_PATH` 付きの `pnpm build`、GitHub Actions（検証からデプロイまで）。
- Git フックの動作確認済み: 規約違反のメッセージを commitlint が拒否する。整形崩れを lint-staged が自動修正する。型エラーのとき pre-push が push を止める。
- 手順1のレビュー（`code-reviewer`、`spec-checker`）は実施済み。必須の指摘は反映した。

## 3. 手順2 の範囲

`docs/spec.md` 9 章の手順2。幾何プリミティブ（距離、交差、面積）、座標の補正（グリッドスナップ、Shift の軸拘束）、入力検証（V-01〜V-06）。テストを先に書く（`write-tests` スキルを使う）。ディレクトリは `src/lib/geometry/`（`types.ts`、`primitives.ts`、`snap.ts`、`validate.ts`）。ε は引数で渡し、グローバル変数にしない。

## 4. 環境の注意点（手順1で踏んだ落とし穴）

- Git Bash で `BASE_PATH=/polyline-partition` を渡すと Windows のパスに変換されて失敗する。`MSYS_NO_PATHCONV=1` を付ける。GitHub Actions（Linux）では起きない。
- Bash のヒアドキュメントで書いたファイルは、バックスラッシュが消えることがある（正規表現の `\\` など）。バックスラッシュを含むコードは Edit ツールで書く。
- この PC では素の `python` コマンドは使えない（Windows ストアのスタブのみ）。Python が必要なときは `uv run python <スクリプト>` で実行する（uv 0.9.21、Python 3.14.2 で動作確認済み）。Node で足りる処理は Node でよい。
- `shadcn-svelte init` は対話式で、CSS 上書きの確認を非対話にできない。プリセットは `apply <コード> -y`、部品は `add <名前> -y -o` を使う。使用中のプリセットは `a2r6bw`。
- `pnpm format` は `.prettierignore` で Markdown、`docs`、`.claude`、`components.json`、`src/lib/components/ui` を除外している。仕様書は整形されない。
- commitlint は件名の先頭が大文字だと拒否する（`subject-case`）。件名は日本語か小文字で始める。
- TypeScript は 6 系を使う（7 系は svelte-check が未対応）。
- ESLint の jsdoc ルールは、`*.test.ts`、`*.spec.ts`、`playwright.config.ts`、`src/lib/utils.ts`、`src/app.d.ts` を対象外にしている。ドキュメントコメントの文体（句点、体言止め）は機械的に強制できないので、`code-reviewer` で確認する。
- `e2e/` のテストは `*.spec.ts`、単体テストは `src/**/*.test.ts`。Vitest の対象は `src` 配下に限定している。

## 5. 未確認・保留の事項

- Svelte 公式 MCP（`.mcp.json`）は接続を確認していない。Svelte のコンポーネントを書く手順7までに、初回承認と動作確認をする。
- `playwright-cli` スキルは `.claude/skills/playwright-cli` に導入済み。実際の操作は手順9で使うまで未検証。
- CI のアクション（`checkout@v4` など）は Node.js 20 の非推奨警告が出ている。動作に影響はない。必要になったらバージョンを上げる。
- `src/lib/constants.test.ts` は、ε の下限と上限しか仕様書の値と突き合わせていない。矩形サイズやスナップの値の固定テストは任意の追加。
- 依存は `cn`（shadcn 公式のクラス結合ライブラリ）など、shadcn-svelte の CLI が追加したものを含む。`handoff.md` の承認済み一覧に反映済み。

## 6. 検証用モック

SvelteKit 3 と shadcn-svelte の検証用モックを、セッションのスクラッチ領域に残している。リポジトリには含まれず、Git にも入っていない。不要なら削除してよい。

## 7. 新しいセッションに最初に渡すプロンプト

```text
docs/handoff-step2.md を読み、その指示に従って実装の手順2を進めてください。
最初に CLAUDE.md、AGENTS.md、docs/spec.md を読み、現在の状態（git status と origin との差分）を報告してください。
そのあと、手順2の範囲と完了条件を3行で伝えてから作業を始めてください。
```
