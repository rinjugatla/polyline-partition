import { expect, test } from '@playwright/test';
import { drawPolyline } from './helpers';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の外側にはみ出す座標（スナップの刻みに合わせる） */
const OUT = -50;
/** 矩形の反対側の外側の座標 */
const OUT_FAR = 1050;

test.describe('区画分割（E2E-01〜04）', () => {
	test.describe('正常系', () => {
		test('E2E-01: 初期表示は ポリライン 0 本、区画数は未分割', async ({ page }) => {
			await page.goto('/');

			await expect(page.getByLabel('幅')).toHaveValue('1000');
			await expect(page.getByLabel('高さ')).toHaveValue('1000');
			await expect(page.getByTestId('stat-polylines')).toHaveText('0');
			await expect(page.getByTestId('stat-regions')).toHaveText('未分割');
		});

		test('E2E-02: 0 本のまま分割すると区画数 1 になる', async ({ page }) => {
			await page.goto('/');

			await page.getByRole('button', { name: '区画分割' }).click();

			await expect(page.getByTestId('stat-regions')).toHaveText('1');
		});

		test('E2E-03: 矩形を横切る線を1本描いて分割すると区画数 2 になる', async ({ page }) => {
			await page.goto('/');
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);

			await page.getByRole('button', { name: '区画分割' }).click();

			await expect(page.getByTestId('stat-regions')).toHaveText('2');
			await expect(page.getByTestId('region')).toHaveCount(2);
		});

		test('E2E-04: 2 本を十字に交差させて分割すると区画数 4 になる', async ({ page }) => {
			await page.goto('/');
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);
			await drawPolyline(page, [
				{ x: MID, y: OUT },
				{ x: MID, y: OUT_FAR }
			]);

			await page.getByRole('button', { name: '区画分割' }).click();

			await expect(page.getByTestId('stat-polylines')).toHaveText('2');
			await expect(page.getByTestId('stat-regions')).toHaveText('4');
		});
	});
});
