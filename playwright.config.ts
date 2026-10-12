import { defineConfig, devices } from '@playwright/test';

/** プレビューサーバーのポート */
const PREVIEW_PORT = 4173;

/** E2E テストのビューポート（仕様書 第8章） */
const VIEWPORT = { width: 1280, height: 800 };

export default defineConfig({
	testDir: 'e2e',
	// ビルド済みのアプリ（BASE_PATH なし）に対して実行する
	webServer: {
		command: `pnpm build && pnpm preview --port ${PREVIEW_PORT}`,
		port: PREVIEW_PORT,
		reuseExistingServer: !process.env.CI
	},
	use: { baseURL: `http://localhost:${PREVIEW_PORT}` },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: VIEWPORT } }]
});
