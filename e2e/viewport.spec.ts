import { expect, test, type Page } from '@playwright/test';

/** ホイール 1 目盛りの移動量。符号が負だと拡大、正だと縮小 */
const WHEEL_DELTA = 100;
/** ズームの下限・上限に届くのに十分なホイールの回数（1.1 倍ずつで 100 倍を超える） */
const WHEEL_TIMES_TO_LIMIT = 80;
/** 上限・下限に達したあとに追加で回す回数 */
const EXTRA_WHEEL_TIMES = 5;
/** 全体表示に対する下限の倍率（constants.ts の MIN_ZOOM_RATIO） */
const MIN_RATIO = 0.1;
/** 全体表示に対する上限の倍率（constants.ts の MAX_ZOOM_RATIO） */
const MAX_RATIO = 100;
/** 比率の比較の許容誤差の桁数 */
const RATIO_PRECISION = 2;
/** boundingBox が枠の線の太さ分だけ大きく返す余白の合計（ピクセル）。倍率の比較から除く */
const BOX_PAD = 8;
/** 位置・大きさの比較の許容誤差の桁数（ピクセル） */
const PIXEL_PRECISION = 0;
/** パンで動かす量（ピクセル） */
const PAN_DISTANCE = 80;
/** 拡大縮小の確認に使うホイールの回数 */
const WHEEL_TIMES = 3;
/** カーソルを矩形の左上寄りに置くときの割合 */
const CURSOR_RATIO = 0.25;

/** 枠のスクリーン上の矩形 */
type Box = { x: number; y: number; width: number; height: number };

/**
 * 基礎矩形の枠の表示領域を取得
 *
 * @param page ページ
 * @returns 枠の表示領域
 */
async function frameBox(page: Page): Promise<Box> {
	const box = await page.getByTestId('rect-frame').boundingBox();
	if (box === null) throw new Error('基礎矩形が表示されていない');
	return box;
}

/**
 * 指定位置でホイールを回す
 *
 * @param page ページ
 * @param at ホイールを回す画面座標
 * @param times 回数
 * @param delta 1 回の移動量（負で拡大）
 */
async function wheelAt(
	page: Page,
	at: { x: number; y: number },
	times: number,
	delta: number
): Promise<void> {
	await page.mouse.move(at.x, at.y);
	for (let i = 0; i < times; i++) {
		await page.mouse.wheel(0, delta);
	}
}

/**
 * 枠の中心の画面座標を取得
 *
 * @param box 枠の表示領域
 * @returns 中心の座標
 */
function centerOf(box: Box): { x: number; y: number } {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('キャンバス操作（FR-09）', () => {
	test.describe('正常系', () => {
		test('ホイールを手前に回して拡大すると、枠の表示サイズが大きくなる', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);

			await wheelAt(page, centerOf(before), WHEEL_TIMES, -WHEEL_DELTA);

			const after = await frameBox(page);
			expect(after.width).toBeGreaterThan(before.width);
			expect(after.height).toBeGreaterThan(before.height);
		});

		test('ホイールを奥に回して縮小すると、枠の表示サイズが小さくなる', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);

			await wheelAt(page, centerOf(before), WHEEL_TIMES, WHEEL_DELTA);

			const after = await frameBox(page);
			expect(after.width).toBeLessThan(before.width);
			expect(after.height).toBeLessThan(before.height);
		});

		test('ズームはカーソル位置を中心に行われ、枠の中心にカーソルを置くと中心が動かない', async ({
			page
		}) => {
			await page.goto('/');
			const before = await frameBox(page);
			const center = centerOf(before);

			await wheelAt(page, center, WHEEL_TIMES, -WHEEL_DELTA);

			const afterCenter = centerOf(await frameBox(page));
			expect(afterCenter.x).toBeCloseTo(center.x, PIXEL_PRECISION);
			expect(afterCenter.y).toBeCloseTo(center.y, PIXEL_PRECISION);
		});

		test('カーソルが枠の左上寄りにあるとき、左上の点が動かずに拡大される', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);
			const cursor = {
				x: before.x + before.width * CURSOR_RATIO,
				y: before.y + before.height * CURSOR_RATIO
			};

			await wheelAt(page, cursor, WHEEL_TIMES, -WHEEL_DELTA);

			const after = await frameBox(page);
			// カーソルの下の点が同じ割合の位置に残る
			expect((cursor.x - after.x) / after.width).toBeCloseTo(CURSOR_RATIO, RATIO_PRECISION);
			expect((cursor.y - after.y) / after.height).toBeCloseTo(CURSOR_RATIO, RATIO_PRECISION);
		});

		test('中ボタンドラッグで枠の位置が動き、大きさは変わらない', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);
			const start = centerOf(before);

			await page.mouse.move(start.x, start.y);
			await page.mouse.down({ button: 'middle' });
			await page.mouse.move(start.x + PAN_DISTANCE, start.y + PAN_DISTANCE);
			await page.mouse.up({ button: 'middle' });

			const after = await frameBox(page);
			expect(after.x - before.x).toBeCloseTo(PAN_DISTANCE, PIXEL_PRECISION);
			expect(after.y - before.y).toBeCloseTo(PAN_DISTANCE, PIXEL_PRECISION);
			expect(after.width).toBeCloseTo(before.width, PIXEL_PRECISION);
			expect(after.height).toBeCloseTo(before.height, PIXEL_PRECISION);
		});

		test('ズームとパンのあと「全体表示」で元の位置と大きさに戻る', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);
			const start = centerOf(before);
			await wheelAt(page, start, WHEEL_TIMES, -WHEEL_DELTA);
			await page.mouse.down({ button: 'middle' });
			await page.mouse.move(start.x + PAN_DISTANCE, start.y + PAN_DISTANCE);
			await page.mouse.up({ button: 'middle' });

			await page.getByRole('button', { name: '全体表示' }).click();

			const after = await frameBox(page);
			expect(after.x).toBeCloseTo(before.x, PIXEL_PRECISION);
			expect(after.y).toBeCloseTo(before.y, PIXEL_PRECISION);
			expect(after.width).toBeCloseTo(before.width, PIXEL_PRECISION);
			expect(after.height).toBeCloseTo(before.height, PIXEL_PRECISION);
		});
	});

	test.describe('異常系', () => {
		test('左ボタンのドラッグでは、パンされず枠の位置が変わらない', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);
			const start = centerOf(before);

			await page.mouse.move(start.x, start.y);
			await page.mouse.down();
			await page.mouse.move(start.x + PAN_DISTANCE, start.y + PAN_DISTANCE);
			await page.mouse.up();

			const after = await frameBox(page);
			expect(after.x).toBeCloseTo(before.x, PIXEL_PRECISION);
			expect(after.y).toBeCloseTo(before.y, PIXEL_PRECISION);
		});

		test('中ボタンを離したあとにマウスを動かしても、パンは続かない', async ({ page }) => {
			await page.goto('/');
			const start = centerOf(await frameBox(page));
			await page.mouse.move(start.x, start.y);
			await page.mouse.down({ button: 'middle' });
			await page.mouse.move(start.x + PAN_DISTANCE, start.y);
			await page.mouse.up({ button: 'middle' });
			const afterPan = await frameBox(page);

			await page.mouse.move(start.x + PAN_DISTANCE * 2, start.y + PAN_DISTANCE);

			const after = await frameBox(page);
			expect(after.x).toBeCloseTo(afterPan.x, PIXEL_PRECISION);
			expect(after.y).toBeCloseTo(afterPan.y, PIXEL_PRECISION);
		});

		test('動かしていない状態で「全体表示」を押しても、表示は変わらない', async ({ page }) => {
			await page.goto('/');
			const before = await frameBox(page);

			await page.getByRole('button', { name: '全体表示' }).click();

			const after = await frameBox(page);
			expect(after.x).toBeCloseTo(before.x, PIXEL_PRECISION);
			expect(after.width).toBeCloseTo(before.width, PIXEL_PRECISION);
		});
	});

	test.describe('境界条件', () => {
		test('拡大を続けても、全体表示の上限倍率で止まる', async ({ page }) => {
			await page.goto('/');
			const fit = await frameBox(page);
			const center = centerOf(fit);

			await wheelAt(page, center, WHEEL_TIMES_TO_LIMIT, -WHEEL_DELTA);
			const atLimit = await frameBox(page);
			await wheelAt(page, center, EXTRA_WHEEL_TIMES, -WHEEL_DELTA);
			const beyond = await frameBox(page);

			expect((atLimit.width - BOX_PAD) / (fit.width - BOX_PAD)).toBeCloseTo(
				MAX_RATIO,
				RATIO_PRECISION
			);
			expect(beyond.width).toBeCloseTo(atLimit.width, PIXEL_PRECISION);
		});

		test('縮小を続けても、全体表示の下限倍率で止まる', async ({ page }) => {
			await page.goto('/');
			const fit = await frameBox(page);
			const center = centerOf(fit);

			await wheelAt(page, center, WHEEL_TIMES_TO_LIMIT, WHEEL_DELTA);
			const atLimit = await frameBox(page);
			await wheelAt(page, center, EXTRA_WHEEL_TIMES, WHEEL_DELTA);
			const beyond = await frameBox(page);

			expect((atLimit.width - BOX_PAD) / (fit.width - BOX_PAD)).toBeCloseTo(
				MIN_RATIO,
				RATIO_PRECISION
			);
			expect(beyond.width).toBeCloseTo(atLimit.width, PIXEL_PRECISION);
		});

		test('上限まで拡大したあとでも「全体表示」で元に戻る', async ({ page }) => {
			await page.goto('/');
			const fit = await frameBox(page);
			await wheelAt(page, centerOf(fit), WHEEL_TIMES_TO_LIMIT, -WHEEL_DELTA);

			await page.getByRole('button', { name: '全体表示' }).click();

			const after = await frameBox(page);
			expect(after.x).toBeCloseTo(fit.x, PIXEL_PRECISION);
			expect(after.y).toBeCloseTo(fit.y, PIXEL_PRECISION);
			expect(after.width).toBeCloseTo(fit.width, PIXEL_PRECISION);
		});
	});
});
