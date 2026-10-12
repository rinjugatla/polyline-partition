import { describe, expect, it } from 'vitest';
import { MAX_SNAP_STEP, MIN_SNAP_STEP } from '../constants';
import { resolveInputPoint, snapToGrid } from './snap';
import type { Point, SnapSettings } from './types';

/** 座標の比較に使う小数点以下の桁数 */
const COORDINATE_PRECISION = 9;

/** テスト用の刻み */
const STEP = 10;
/** 刻みの半分より小さい端数 */
const SMALL_REMAINDER = 3;
/** 刻みの半分より大きい端数 */
const LARGE_REMAINDER = 7;
/** 刻みのちょうど半分 */
const HALF_STEP = 5;
/** 刻みの4分の1 */
const QUARTER = 0.25;
/** 基準の頂点の座標 */
const BASE: Point = { x: 20, y: 30 };
/** 基準から x 方向に大きく離れた位置の差 */
const WIDE_DELTA = 100;
/** 基準から y 方向に小さく離れた位置の差 */
const NARROW_DELTA = 4;

/** スナップ有効の設定 */
const SNAP_ON: SnapSettings = { enabled: true, step: STEP };
/** スナップ無効の設定 */
const SNAP_OFF: SnapSettings = { enabled: false, step: STEP };

describe('グリッドスナップ', () => {
	describe('正常系', () => {
		it('近い格子点に吸着する', () => {
			const snapped = snapToGrid({ x: STEP + SMALL_REMAINDER, y: STEP + LARGE_REMAINDER }, STEP);

			expect(snapped).toEqual({ x: STEP, y: STEP * 2 });
		});

		it('負の座標も近い格子点に吸着する', () => {
			const snapped = snapToGrid(
				{ x: -(STEP + SMALL_REMAINDER), y: -(STEP + LARGE_REMAINDER) },
				STEP
			);

			expect(snapped).toEqual({ x: -STEP, y: -STEP * 2 });
		});
	});

	describe('異常系', () => {
		it('格子点上の座標は動かない', () => {
			expect(snapToGrid({ x: STEP, y: 0 }, STEP)).toEqual({ x: STEP, y: 0 });
		});

		it('負の座標が 0 に吸着しても負のゼロにならない', () => {
			const snapped = snapToGrid({ x: -SMALL_REMAINDER, y: -SMALL_REMAINDER }, STEP);

			expect(Object.is(snapped.x, 0)).toBe(true);
			expect(Object.is(snapped.y, 0)).toBe(true);
		});
	});

	describe('境界条件', () => {
		it('刻みの下限でも格子点に吸着する', () => {
			const raw = MIN_SNAP_STEP * 2 + MIN_SNAP_STEP * QUARTER;

			const snapped = snapToGrid({ x: raw, y: 0 }, MIN_SNAP_STEP);

			expect(snapped.x).toBeCloseTo(MIN_SNAP_STEP * 2, COORDINATE_PRECISION);
		});

		it('刻みの上限でも格子点に吸着する', () => {
			const snapped = snapToGrid({ x: MAX_SNAP_STEP + SMALL_REMAINDER, y: 0 }, MAX_SNAP_STEP);

			expect(snapped.x).toBe(MAX_SNAP_STEP);
		});

		it('刻みのちょうど半分の位置は大きいほうの格子点に吸着する', () => {
			expect(snapToGrid({ x: HALF_STEP, y: 0 }, STEP).x).toBe(STEP);
		});
	});
});

describe('入力座標の補正', () => {
	describe('正常系', () => {
		it('スナップが有効で Shift なしなら、格子点に吸着する', () => {
			const resolved = resolveInputPoint({
				point: { x: STEP + SMALL_REMAINDER, y: STEP + LARGE_REMAINDER },
				snap: SNAP_ON,
				axisBase: null,
				isAxisConstrained: false
			});

			expect(resolved).toEqual({ x: STEP, y: STEP * 2 });
		});

		it('スナップが無効で Shift なしなら、座標をそのまま返す', () => {
			const point = { x: STEP + SMALL_REMAINDER, y: STEP + LARGE_REMAINDER };

			const resolved = resolveInputPoint({
				point,
				snap: SNAP_OFF,
				axisBase: null,
				isAxisConstrained: false
			});

			expect(resolved).toEqual(point);
		});

		it('Shift で x の差が大きいときは水平に拘束し、y を基準に合わせる', () => {
			const resolved = resolveInputPoint({
				point: { x: BASE.x + WIDE_DELTA, y: BASE.y + NARROW_DELTA },
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: BASE.x + WIDE_DELTA, y: BASE.y });
		});

		it('Shift で y の差が大きいときは垂直に拘束し、x を基準に合わせる', () => {
			const resolved = resolveInputPoint({
				point: { x: BASE.x + NARROW_DELTA, y: BASE.y + WIDE_DELTA },
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: BASE.x, y: BASE.y + WIDE_DELTA });
		});

		it('拘束されない軸の座標にはスナップを適用する', () => {
			const resolved = resolveInputPoint({
				point: { x: BASE.x + WIDE_DELTA + SMALL_REMAINDER, y: BASE.y + NARROW_DELTA },
				snap: SNAP_ON,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: BASE.x + WIDE_DELTA, y: BASE.y });
		});
	});

	describe('異常系', () => {
		it('基準の頂点がないときは Shift を押していても拘束しない', () => {
			const point = { x: STEP + SMALL_REMAINDER, y: STEP + NARROW_DELTA };

			const resolved = resolveInputPoint({
				point,
				snap: SNAP_OFF,
				axisBase: null,
				isAxisConstrained: true
			});

			expect(resolved).toEqual(point);
		});

		it('基準の頂点がなくスナップが有効なときは、拘束せずスナップだけ適用する', () => {
			const resolved = resolveInputPoint({
				point: { x: STEP + SMALL_REMAINDER, y: STEP + LARGE_REMAINDER },
				snap: SNAP_ON,
				axisBase: null,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: STEP, y: STEP * 2 });
		});

		it('基準の頂点があっても Shift を押していなければ拘束しない', () => {
			const point = { x: BASE.x + WIDE_DELTA, y: BASE.y + NARROW_DELTA };

			const resolved = resolveInputPoint({
				point,
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: false
			});

			expect(resolved).toEqual(point);
		});
	});

	describe('境界条件', () => {
		it('x と y の差の絶対値が等しいときは水平を優先する', () => {
			const resolved = resolveInputPoint({
				point: { x: BASE.x + WIDE_DELTA, y: BASE.y + WIDE_DELTA },
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: BASE.x + WIDE_DELTA, y: BASE.y });
		});

		it('差が負の向きでも絶対値で水平か垂直かを決める', () => {
			const resolved = resolveInputPoint({
				point: { x: BASE.x - NARROW_DELTA, y: BASE.y - WIDE_DELTA },
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual({ x: BASE.x, y: BASE.y - WIDE_DELTA });
		});

		it('カーソルが基準の頂点と同じ位置のときは水平に拘束する', () => {
			const resolved = resolveInputPoint({
				point: BASE,
				snap: SNAP_OFF,
				axisBase: BASE,
				isAxisConstrained: true
			});

			expect(resolved).toEqual(BASE);
		});
	});
});
