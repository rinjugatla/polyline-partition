import type { Page } from '@playwright/test';

/** 既定の基礎矩形の一辺（論理座標） */
const DEFAULT_SIDE = 1000;

/** 論理座標の点 */
export type LogicalPoint = {
	/**
	 *
	 */
	x: number; /**
	 *
	 */
	y: number;
};

/**
 * 論理座標を画面座標に変換
 *
 * 全体表示を前提に、基礎矩形の枠の位置から求める。右手座標系なので Y 軸を反転する。
 *
 * @param page ページ
 * @param point 論理座標
 * @returns 画面座標
 */
export async function toScreenPoint(page: Page, point: LogicalPoint): Promise<LogicalPoint> {
	const box = await page.getByTestId('rect-frame').boundingBox();
	if (box === null) throw new Error('基礎矩形が表示されていない');
	return {
		x: box.x + (point.x / DEFAULT_SIDE) * box.width,
		y: box.y + box.height - (point.y / DEFAULT_SIDE) * box.height
	};
}

/**
 * 描画モードで、論理座標の点を順にクリックして Enter で確定する
 *
 * @param page ページ
 * @param points 頂点（論理座標）
 */
export async function drawPolyline(page: Page, points: LogicalPoint[]): Promise<void> {
	await page.getByRole('button', { name: '描画' }).click();
	for (const point of points) {
		const screen = await toScreenPoint(page, point);
		await page.mouse.click(screen.x, screen.y);
	}
	await page.keyboard.press('Enter');
}
