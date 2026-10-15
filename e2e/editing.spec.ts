import { expect, test } from '@playwright/test';
import { drawPolyline, toScreenPoint } from './helpers';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の外側にはみ出す座標（スナップの刻みに合わせる） */
const OUT = -50;
/** 矩形の反対側の外側の座標 */
const OUT_FAR = 1050;
/** Shift の軸拘束を確かめるために、水平からずらす量 */
const SKEW = 30;

test.describe('編集操作（E2E-05〜08）', () => {
	test.describe('正常系', () => {
		test('E2E-05: 分割後にポリラインを編集すると、塗りが消えて未分割に戻る', async ({ page }) => {
			await page.goto('/');
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);
			await page.getByRole('button', { name: '区画分割' }).click();
			await expect(page.getByTestId('region')).toHaveCount(2);

			await page.getByRole('button', { name: 'p1 を削除' }).click();

			await expect(page.getByTestId('region')).toHaveCount(0);
			await expect(page.getByTestId('stat-regions')).toHaveText('未分割');
		});

		test('E2E-06: 色を再抽選すると色が変わり、区画数は変わらない', async ({ page }) => {
			await page.goto('/');
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);
			await page.getByRole('button', { name: '区画分割' }).click();
			const fills = (): Promise<(string | null)[]> =>
				page
					.getByTestId('region')
					.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
			const before = await fills();

			await page.getByRole('button', { name: '色を再抽選' }).click();

			const after = await fills();
			expect(after).toHaveLength(before.length);
			expect(after).not.toEqual(before);
			await expect(page.getByTestId('stat-regions')).toHaveText('2');
		});

		test('E2E-07: Undo と Redo で本数が戻り、履歴がないとボタンが無効になる', async ({ page }) => {
			await page.goto('/');
			const undo = page.getByRole('button', { name: 'Undo' });
			const redo = page.getByRole('button', { name: 'Redo' });
			await expect(undo).toBeDisabled();
			await drawPolyline(page, [
				{ x: OUT, y: MID },
				{ x: OUT_FAR, y: MID }
			]);
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');

			await undo.click();
			await expect(page.getByTestId('stat-polylines')).toHaveText('0');
			await expect(redo).toBeEnabled();
			await redo.click();
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');

			await page.getByTestId('canvas').focus();
			await page.keyboard.press('Control+Z');
			await expect(page.getByTestId('stat-polylines')).toHaveText('0');
			await page.keyboard.press('Control+Shift+Z');
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');
		});

		test('E2E-08: Shift を押しながら置くと、直前の頂点から水平に置かれる', async ({ page }) => {
			await page.goto('/');
			await page.getByRole('button', { name: '描画' }).click();
			const first = await toScreenPoint(page, { x: OUT, y: MID });
			const second = await toScreenPoint(page, { x: OUT_FAR, y: MID + SKEW });
			await page.mouse.click(first.x, first.y);

			await page.keyboard.down('Shift');
			await page.mouse.move(second.x, second.y);
			await page.mouse.click(second.x, second.y);
			await page.keyboard.up('Shift');
			await page.keyboard.press('Enter');

			const points = await page.getByTestId('polyline').getAttribute('points');
			const ys = (points ?? '').split(' ').map((pair) => Number(pair.split(',')[1]));
			expect(ys).toHaveLength(2);
			expect(ys[0]).toBeCloseTo(ys[1], 1);
		});

		test('E2E-08: Shift を押しながら置くと、直前の頂点から垂直にも置かれる', async ({ page }) => {
			await page.goto('/');
			await page.getByRole('button', { name: '描画' }).click();
			const first = await toScreenPoint(page, { x: MID, y: OUT });
			const second = await toScreenPoint(page, { x: MID + SKEW, y: OUT_FAR });
			await page.mouse.click(first.x, first.y);

			await page.keyboard.down('Shift');
			await page.mouse.move(second.x, second.y);
			await page.mouse.click(second.x, second.y);
			await page.keyboard.up('Shift');
			await page.keyboard.press('Enter');

			const points = await page.getByTestId('polyline').getAttribute('points');
			const xs = (points ?? '').split(' ').map((pair) => Number(pair.split(',')[0]));
			expect(xs).toHaveLength(2);
			expect(xs[0]).toBeCloseTo(xs[1], 1);
		});
	});
});
