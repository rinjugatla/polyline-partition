import { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO, VIEW_MARGIN_RATIO } from '../constants';
import type { Point, RectSize } from '../geometry/types';

/**
 * 表示の位置と倍率
 *
 * 論理座標（右手座標系、Y 軸上向き）をスクリーン座標（左上が原点、Y 軸下向き）に写す。
 * Y 軸の反転は、この変換だけで行う。
 */
export type Viewport = {
	/** 倍率（論理座標 1 あたりのピクセル数） */
	readonly scale: number;
	/** 論理座標の原点 (0, 0) が写るスクリーンの x */
	readonly originX: number;
	/** 論理座標の原点 (0, 0) が写るスクリーンの y */
	readonly originY: number;
};

/**
 * 論理座標をスクリーン座標に変換
 *
 * @param viewport 表示の位置と倍率
 * @param point 論理座標
 * @returns スクリーン座標（Y 軸を反転する）
 */
export function toScreen(viewport: Viewport, point: Point): Point {
	return {
		x: viewport.originX + point.x * viewport.scale,
		y: viewport.originY - point.y * viewport.scale
	};
}

/**
 * スクリーン座標を論理座標に変換
 *
 * @param viewport 表示の位置と倍率
 * @param point スクリーン座標
 * @returns 論理座標
 */
export function toLogical(viewport: Viewport, point: Point): Point {
	return {
		x: (point.x - viewport.originX) / viewport.scale,
		y: (viewport.originY - point.y) / viewport.scale
	};
}

/**
 * 全体表示の位置と倍率
 *
 * 基礎矩形が画面の中央に収まり、周囲に余白ができる倍率にする。
 *
 * @param rect 基礎矩形の大きさ
 * @param screen 画面（キャンバス）の大きさ
 * @returns 全体表示の位置と倍率
 */
export function fitViewport(rect: RectSize, screen: RectSize): Viewport {
	const usable = 1 - 2 * VIEW_MARGIN_RATIO;
	const scale = Math.min(
		(screen.width * usable) / rect.width,
		(screen.height * usable) / rect.height
	);
	return {
		scale,
		originX: (screen.width - rect.width * scale) / 2,
		// 矩形の下辺（y = 0）が画面の下側に来る
		originY: (screen.height + rect.height * scale) / 2
	};
}

/**
 * カーソル位置を中心に拡大縮小
 *
 * カーソルの下の論理座標が動かないよう、原点も合わせて動かす。
 * 倍率は全体表示の倍率に対する割合で制限する。
 *
 * @param viewport 現在の表示
 * @param cursor カーソルのスクリーン座標
 * @param factor 倍率にかける係数（1 より大きいと拡大）
 * @param fitScale 全体表示の倍率（制限の基準）
 * @returns 拡大縮小後の表示
 */
export function zoomAt(
	viewport: Viewport,
	cursor: Point,
	factor: number,
	fitScale: number
): Viewport {
	const scale = Math.min(
		Math.max(viewport.scale * factor, fitScale * MIN_ZOOM_RATIO),
		fitScale * MAX_ZOOM_RATIO
	);
	const ratio = scale / viewport.scale;
	return {
		scale,
		originX: cursor.x - (cursor.x - viewport.originX) * ratio,
		originY: cursor.y - (cursor.y - viewport.originY) * ratio
	};
}

/**
 * 表示を平行移動
 *
 * @param viewport 現在の表示
 * @param deltaX スクリーン上の x の移動量
 * @param deltaY スクリーン上の y の移動量
 * @returns 移動後の表示
 */
export function panBy(viewport: Viewport, deltaX: number, deltaY: number): Viewport {
	return { ...viewport, originX: viewport.originX + deltaX, originY: viewport.originY + deltaY };
}
