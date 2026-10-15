import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { drawPolyline } from './helpers';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の外側にはみ出す座標（スナップの刻みに合わせる） */
const OUT = -50;
/** 矩形の反対側の外側の座標 */
const OUT_FAR = 1050;

test.describe('保存・出力（E2E-09）', () => {
	test.describe('正常系', () => {
		test('E2E-09: JSON を保存して読み込むと同じ状態になり、SVG の polygon が区画数と一致する', async ({
			page
		}) => {
			await page.goto('/');
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);
			const jsonDownload = page.waitForEvent('download');
			await page.getByRole('button', { name: 'JSON 保存' }).click();
			const jsonPath = await (await jsonDownload).path();
			await page.getByRole('button', { name: '全削除' }).click();
			await expect(page.getByTestId('stat-polylines')).toHaveText('0');

			await page.getByTestId('json-file-input').setInputFiles(jsonPath);

			await expect(page.getByTestId('stat-polylines')).toHaveText('1');
			await expect(page.getByTestId('stat-regions')).toHaveText('未分割');
			await page.getByRole('button', { name: '区画分割' }).click();
			const svgDownload = page.waitForEvent('download');
			await page.getByRole('button', { name: 'SVG 出力' }).click();
			const svg = await readFile((await (await svgDownload).path()) ?? '', 'utf8');
			expect(svg.split('<polygon').length - 1).toBe(2);
		});
	});

	test.describe('異常系', () => {
		test('E2E-16: 不正な JSON を読み込むとエラーが表示され、状態は変わらない', async ({ page }) => {
			await page.goto('/');

			await page.getByTestId('json-file-input').setInputFiles({
				name: 'broken.json',
				mimeType: 'application/json',
				buffer: Buffer.from('{')
			});

			await expect(page.getByTestId('message')).toContainText('JSON');
			await expect(page.getByTestId('stat-polylines')).toHaveText('0');
		});
	});
});
