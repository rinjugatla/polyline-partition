# Commands (Windows; Git Bash / PowerShell 両方あり)

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm check`(svelte-check) / `pnpm lint` / `pnpm format`
- `pnpm test`(vitest run) / `pnpm test:e2e`(Playwright)
- GitHub 操作は必ず `gh` CLI（レビュー返信パスは PR 番号必須: `repos/<o>/<r>/pulls/<n>/comments/<id>/replies`）。
- コミットは `commit` スキル。`--no-verify` 禁止。
- PowerShell 5.1 では `&&` 不可（`;` + `if ($?)`）。Bash ツールは POSIX 構文。
