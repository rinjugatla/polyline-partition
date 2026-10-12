---
name: commit
description: 変更を確認して、Conventional Commits 形式の日本語メッセージでコミットする。コミットや PR の作成を頼まれたときに使う。
---

# commit

コミットと PR 作成の手順。規約の本体は `AGENTS.md` の 3 章にあり、このスキルはその実行手順のみを定める。

## コミット

1. `git status` と `git diff` で変更内容を確認
2. 1 コミット 1 目的に分割。無関係な変更が混在している場合は分ける
3. 対象ファイルを個別に指定して `git add`（`git add -A` と `git add .` は禁止）
4. メッセージを `<type>(<scope>): <概要>` で作成
   - 日本語の自然な文で書く
   - 理由が自明でない場合は本文に「なぜ」を書く
5. `git commit` を実行
   - フックが失敗した場合は原因を修正して新しくコミットし直す
   - `--no-verify` は使用禁止
6. `git log -1` で結果を確認

コミットメッセージの末尾には、セッションの指示に従い次の 2 行を付ける。

```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MUoeKnMGCmnQoAkjedCKKn
```

## PR の作成

- pre-push フックで `pnpm check` / `pnpm lint` / `pnpm test` が走るため、push に時間がかかる
- `gh pr create` を使い、タイトルは Conventional Commits 形式、本文は日本語で「概要」「変更内容」「確認方法」の 3 節にする
- 事実と推論を分けて書き、技術用語は初出時に平易な 1 文を添える
- 本文の末尾に次を付ける

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MUoeKnMGCmnQoAkjedCKKn
```

- レビューコメントへの返信は `AGENTS.md` 3.2 の `replies` パス（PR 番号を含む）を使う
