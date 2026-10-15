import { expect, test, type Page } from '@playwright/test';
import { drawPolyline, toScreenPoint, type LogicalPoint } from './helpers';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の外側にはみ出す座標（スナップの刻みに合わせる） */
const OUT = -50;
/** 矩形の反対側の外側の座標 */
const OUT_FAR = 1050;
/** 拡大後の矩形の幅 */
const WIDE = 2000;
/** 境界のすぐ外に置く始点の x 座標（ε = 1 より内側） */
const NEAR_OUTSIDE = -0.5;
/** 矩形の一辺の下限 */
const MIN_SIDE = 10;
/** 矩形の一辺の上限 */
const MAX_SIDE = 10000;
/** ε の入力欄のラベル */
const EPSILON_LABEL = 'ε（同値判定の許容誤差）';

/**
 * 点列を描いて確定を試みる
 *
 * @param page ページ
 * @param points 頂点（論理座標）
 */
async function tryDraw(page: Page, points: LogicalPoint[]): Promise<void> {
	await page.goto('/');
	await drawPolyline(page, points);
}

/**
 * 確定に失敗し、エラーが表示されていることを確かめる
 *
 * @param page ページ
 */
async function expectRejected(page: Page): Promise<void> {
	await expect(page.getByTestId('message')).toBeVisible();
	await expect(page.getByTestId('stat-polylines')).toHaveText('0');
}

/**
 * 入力欄に値を入れて確定（change イベントを発火）する
 *
 * @param page ページ
 * @param label 入力欄のラベル
 * @param value 入れる値
 */
async function enterValue(page: Page, label: string, value: string): Promise<void> {
	const input = page.getByLabel(label, { exact: true });
	await input.fill(value);
	await input.press('Tab');
}

test.describe('異常系・境界条件（E2E-10〜19）', () => {
	test.describe('正常系', () => {
		test('E2E-10: 設定を変更して再読み込みしても、値が保持される', async ({ page }) => {
			await page.goto('/');
			await enterValue(page, EPSILON_LABEL, '0.5');
			await enterValue(page, 'スナップの刻み', '25');

			await page.reload();

			await expect(page.getByLabel(EPSILON_LABEL)).toHaveValue('0.5');
			await expect(page.getByLabel('スナップの刻み')).toHaveValue('25');
		});
	});

	test.describe('異常系', () => {
		test('E2E-11: 始点が矩形の内部にあるポリラインは確定できない', async ({ page }) => {
			await tryDraw(page, [
				{ x: MID, y: MID },
				{ x: OUT_FAR, y: MID }
			]);

			await expectRejected(page);
		});

		test('E2E-12: 自己交差になる頂点は追加できず、エラーが表示される', async ({ page }) => {
			await page.goto('/');
			await page.getByRole('button', { name: '描画' }).click();
			const points: LogicalPoint[] = [
				{ x: OUT, y: 300 },
				{ x: OUT_FAR, y: 300 },
				{ x: OUT_FAR, y: 700 },
				{ x: MID, y: 700 },
				{ x: MID, y: 100 }
			];

			for (const point of points) {
				const screen = await toScreenPoint(page, point);
				await page.mouse.click(screen.x, screen.y);
			}

			await expect(page.getByTestId('message')).toBeVisible();
		});

		test('E2E-13: 矩形を広げて始点が内側に入ると、無効と表示され分割できない', async ({ page }) => {
			await tryDraw(page, [
				{ x: OUT_FAR, y: MID },
				{ x: OUT, y: MID }
			]);
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');

			await enterValue(page, '幅', String(WIDE));

			await expect(page.getByTestId('polyline')).toHaveAttribute('data-invalid', 'true');
			await expect(page.getByTestId('polyline-list')).toContainText('無効');
			await expect(page.getByRole('button', { name: '区画分割' })).toBeDisabled();
		});

		test('E2E-14: ε を大きくすると、境界のすぐ外の始点が無効になる', async ({ page }) => {
			await page.goto('/');
			const document = {
				schemaVersion: 1,
				rect: { width: 1000, height: 1000 },
				polylines: [
					{
						id: 'p1',
						vertices: [
							{ x: NEAR_OUTSIDE, y: MID },
							{ x: OUT_FAR, y: MID }
						]
					}
				],
				colorSeed: 1
			};
			await page.getByTestId('json-file-input').setInputFiles({
				name: 'near.json',
				mimeType: 'application/json',
				buffer: Buffer.from(JSON.stringify(document))
			});
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');
			await expect(page.getByRole('button', { name: '区画分割' })).toBeEnabled();

			await enterValue(page, EPSILON_LABEL, '1');

			await expect(page.getByTestId('polyline-list')).toContainText('無効');
			await expect(page.getByRole('button', { name: '区画分割' })).toBeDisabled();
		});

		test('E2E-15: 矩形と交わらない線は確定できない', async ({ page }) => {
			await tryDraw(page, [
				{ x: OUT, y: OUT_FAR },
				{ x: OUT_FAR, y: OUT_FAR }
			]);

			await expectRejected(page);
		});

		test('E2E-15: 角をかすめるだけの線は確定できない', async ({ page }) => {
			await tryDraw(page, [
				{ x: OUT, y: -OUT },
				{ x: -OUT, y: OUT }
			]);

			await expectRejected(page);
		});

		test('E2E-15: 境界線上だけの線は確定できない', async ({ page }) => {
			await tryDraw(page, [
				{ x: OUT, y: 0 },
				{ x: OUT_FAR, y: 0 }
			]);

			await expectRejected(page);
		});

		test('E2E-17: 範囲外の ε とスナップの刻みは設定できず、直前の値が保たれる', async ({
			page
		}) => {
			await page.goto('/');
			const epsilon = page.getByLabel(EPSILON_LABEL);
			const step = page.getByLabel('スナップの刻み');
			const epsilonBefore = await epsilon.inputValue();
			const stepBefore = await step.inputValue();

			await enterValue(page, EPSILON_LABEL, '5');
			await expect(page.getByTestId('settings-error')).toBeVisible();
			await expect(epsilon).toHaveValue(epsilonBefore);

			await enterValue(page, 'スナップの刻み', '5000');
			await expect(step).toHaveValue(stepBefore);
		});
	});

	test.describe('境界条件', () => {
		test('E2E-18: 幅と高さは 10 と 10000 を受け付け、範囲外は拒否する', async ({ page }) => {
			await page.goto('/');
			const width = page.getByLabel('幅');

			for (const accepted of [MIN_SIDE, MAX_SIDE]) {
				await enterValue(page, '幅', String(accepted));
				await expect(width).toHaveValue(String(accepted));
			}
			for (const rejected of [MIN_SIDE - 1, MAX_SIDE + 1]) {
				await enterValue(page, '幅', String(rejected));
				await expect(width).toHaveValue(String(MAX_SIDE));
			}
		});

		test('E2E-19: 境界に沿う部分と内部を通る部分の両方を持つ線は確定でき、区画数 2 になる', async ({
			page
		}) => {
			await tryDraw(page, [
				{ x: OUT, y: 0 },
				{ x: MID, y: 0 },
				{ x: MID, y: OUT_FAR }
			]);
			await expect(page.getByTestId('stat-polylines')).toHaveText('1');

			await page.getByRole('button', { name: '区画分割' }).click();

			await expect(page.getByTestId('stat-regions')).toHaveText('2');
		});
	});
});
