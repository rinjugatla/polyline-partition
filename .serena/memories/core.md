# polyline-partition core

- 基礎矩形をポリラインで区画分割し、ランダム色で塗り分ける静的 Web アプリ。面抽出は自前実装（外部の幾何ライブラリ禁止）。
- 仕様の正は `docs/spec.md`（ID: FR / V-01..06 / E2E）。規約の正は `AGENTS.md`（`CLAUDE.md` は `@AGENTS.md` を取り込むだけ）。仕様を複製しない。仕様変更は先に spec.md を更新。
- 既知の制約: `docs/known-limitations.md`。環境の注意点も同文書。
- 実装順序と進捗は spec.md 9 章と `git log` を正とする（このメモリに進捗を書かない）。
- ソース構成:
  - `src/lib/geometry/` UI 非依存の純粋 TS（types, primitives, snap, validate, noding と同居の `*.test.ts`）
  - `src/lib/constants.ts` 数値の名前付き定数（マジックナンバー禁止、理由を TSDoc に書く）
  - `src/lib/components/` 専用パーツは1ファイル1つ PascalCase、`ui/` は shadcn-svelte（CLI 追加）
  - `src/routes/` `+layout.ts`(prerender), `+page.svelte`。`e2e/` Playwright
- 依存方向は components → state → geometry の一方向。ε は引数で渡す（グローバル禁止）。
- 点の同一判定は ε 付き共通関数（`isSamePoint` 等）を必ず通す。頂点併合後は ID で扱う。
- `.claude/` に agents(code-reviewer, spec-checker)、skills(commit, write-tests, playwright-cli)。Svelte 公式 MCP は `.mcp.json`。
- 規約詳細: `mem:conventions` / 技術: `mem:tech_stack` / コマンド: `mem:suggested_commands` / 完了条件: `mem:task_completion`
