# Tech stack

- SvelteKit 3 + Svelte 5 (runes) + TypeScript 6 strict、Vite 8、adapter-static (`prerender = true`)。SvelteKit 3 は `svelte.config.js` を使わず `vite.config.ts` に設定。
- pnpm（corepack 経由）、Node.js LTS。
- UI: shadcn-svelte + Tailwind CSS 4 + Bits UI。アイコン remixicon-svelte。スタイルは Tailwind ユーティリティのみ。
- テスト: Vitest（単体、`*.test.ts` を対象と同じ場所）、fast-check（プロパティテスト専用）、Playwright（Chromium のみ、`e2e/`）。
- Lint/整形: ESLint 10 (typescript-eslint, eslint-plugin-jsdoc, eslint-plugin-svelte)、Prettier(+svelte plugin)、svelte-check。
- Git フック: husky + lint-staged + commitlint (Conventional Commits)。
- デプロイ: GitHub Pages（Actions、`BASE_PATH` env で `/polyline-partition`）。
- import エイリアス: `#lib`, `#lib/*` (package.json imports)。
