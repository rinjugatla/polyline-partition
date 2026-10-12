import { expect, test } from '@playwright/test';

test.describe('起動確認', () => {
	test.describe('正常系', () => {
		test('トップページに見出しが表示される', async ({ page }) => {
			await page.goto('/');

			await expect(page.getByRole('heading', { name: 'polyline-partition' })).toBeVisible();
		});
	});

	test.describe('異常系', () => {
		test('存在しないページは見出しを表示しない', async ({ page }) => {
			await page.goto('/not-found');

			await expect(page.getByRole('heading', { name: 'polyline-partition' })).toHaveCount(0);
		});
	});

	test.describe('境界条件', () => {
		test('ページの言語が日本語に設定されている', async ({ page }) => {
			await page.goto('/');

			await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
		});
	});
});
