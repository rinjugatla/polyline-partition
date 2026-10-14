# Task completion

- 必須: `pnpm check`、`pnpm lint`、`pnpm test` がすべて通る（通らない変更はコミットしない。pre-push も同じ3つ）。
- 画面を変えたら `pnpm test:e2e` も通す（フックには入らない。CI で実行）。
- 実装の区切り/コミット前: `code-reviewer` エージェントで差分レビュー、機能実装後・仕様変更後: `spec-checker` で仕様 ID の抜けを確認。
- 仕様変更は先に `docs/spec.md` を更新。仕様が曖昧なら実装前に質問。
- コミットは `commit` スキル（Conventional Commits、日本語、1コミット1目的）。
