import { describe, expect, it } from 'vitest';
import { MAX_ZOOM_RATIO, MIN_ZOOM_RATIO } from '../constants';
import { fitViewport, panBy, toLogical, toScreen, zoomAt, type Viewport } from './viewport';

/** 画面の幅 */
const SCREEN_WIDTH = 1000;
/** 画面の高さ */
const SCREEN_HEIGHT = 800;
/** 基礎矩形の辺の長さ */
const SIDE = 100;
/** テスト用の点の x */
const POINT_X = 30;
/** テスト用の点の y */
const POINT_Y = 70;
/** 拡大の係数 */
const ZOOM_IN = 2;
/** 縮小の係数 */
const ZOOM_OUT = 0.5;
/** 桁数の指定 */
const PRECISION = 9;
/** パンの移動量 */
const PAN_X = 15;
/** パンの移動量（y） */
const PAN_Y = -25;
/** 範囲を超えて拡大するための大きな係数 */
const HUGE_FACTOR = 1e6;
/** 範囲を超えて縮小するための小さな係数 */
const TINY_FACTOR = 1e-6;

const SCREEN = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };
const RECT = { width: SIDE, height: SIDE };
const FIT: Viewport = fitViewport(RECT, SCREEN);

describe('表示の変換', () => {
	describe('正常系', () => {
		it('論理座標をスクリーンへ変換すると Y 軸が反転する', () => {
			const viewport: Viewport = { scale: 1, originX: 0, originY: SCREEN_HEIGHT };

			expect(toScreen(viewport, { x: POINT_X, y: POINT_Y })).toEqual({
				x: POINT_X,
				y: SCREEN_HEIGHT - POINT_Y
			});
		});

		it('スクリーンへ変換して戻すと、元の論理座標になる', () => {
			const point = { x: POINT_X, y: POINT_Y };

			const back = toLogical(FIT, toScreen(FIT, point));

			expect(back.x).toBeCloseTo(point.x, PRECISION);
			expect(back.y).toBeCloseTo(point.y, PRECISION);
		});

		it('全体表示では、矩形が画面の中央に収まる', () => {
			const center = toScreen(FIT, { x: SIDE / 2, y: SIDE / 2 });

			expect(center.x).toBeCloseTo(SCREEN_WIDTH / 2, PRECISION);
			expect(center.y).toBeCloseTo(SCREEN_HEIGHT / 2, PRECISION);
		});

		it('ズームしても、カーソルの下の論理座標は動かない', () => {
			const cursor = { x: POINT_X * ZOOM_IN, y: POINT_Y * ZOOM_IN };
			const before = toLogical(FIT, cursor);

			const after = toLogical(zoomAt(FIT, cursor, ZOOM_IN, FIT.scale), cursor);

			expect(after.x).toBeCloseTo(before.x, PRECISION);
			expect(after.y).toBeCloseTo(before.y, PRECISION);
		});

		it('パンすると、原点が移動量だけ動く', () => {
			const panned = panBy(FIT, PAN_X, PAN_Y);

			expect(panned.originX).toBe(FIT.originX + PAN_X);
			expect(panned.originY).toBe(FIT.originY + PAN_Y);
			expect(panned.scale).toBe(FIT.scale);
		});
	});

	describe('異常系', () => {
		it('縮小しすぎても、倍率は下限で止まる', () => {
			const zoomed = zoomAt(FIT, { x: 0, y: 0 }, TINY_FACTOR, FIT.scale);

			expect(zoomed.scale).toBeCloseTo(FIT.scale * MIN_ZOOM_RATIO, PRECISION);
		});

		it('拡大しすぎても、倍率は上限で止まる', () => {
			const zoomed = zoomAt(FIT, { x: 0, y: 0 }, HUGE_FACTOR, FIT.scale);

			expect(zoomed.scale).toBeCloseTo(FIT.scale * MAX_ZOOM_RATIO, PRECISION);
		});
	});

	describe('境界条件', () => {
		it('縦長の画面では、幅に合わせた倍率になる', () => {
			const tall = fitViewport(RECT, { width: SIDE, height: SCREEN_HEIGHT });
			const wide = fitViewport(RECT, { width: SCREEN_WIDTH, height: SIDE });

			expect(tall.scale).toBe(wide.scale);
		});

		it('拡大してから同じ割合で縮小すると、元の表示に戻る', () => {
			const cursor = { x: POINT_X, y: POINT_Y };

			const back = zoomAt(zoomAt(FIT, cursor, ZOOM_IN, FIT.scale), cursor, ZOOM_OUT, FIT.scale);

			expect(back.scale).toBeCloseTo(FIT.scale, PRECISION);
			expect(back.originX).toBeCloseTo(FIT.originX, PRECISION);
			expect(back.originY).toBeCloseTo(FIT.originY, PRECISION);
		});
	});
});
