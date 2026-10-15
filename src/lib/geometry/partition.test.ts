import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import { partition, type PartitionOutcome, type PartitionResult } from './partition';
import type { Point, Polyline, RectSize } from './types';

/** 基礎矩形の辺の長さ */
const SIDE = 100;
/** 矩形の中央の座標 */
const MID = 50;
/** 矩形の外側へはみ出す距離 */
const OVER = 10;
/** 矩形の外側の座標（辺の長さ + はみ出す距離） */
const OUTER = SIDE + OVER;
/** 矩形の面積 */
const RECT_AREA = SIDE * SIDE;
/** 十字に交差させたときの区画数 */
const CROSS_REGION_COUNT = 4;
/** 区画に番号を振る順で、左下から右上までの区画の数（番号は 0 から） */
const LAST_REGION_ID = 3;
/** 3本が1点で交わるときの区画数 */
const CONCURRENT_REGION_COUNT = 6;
/** 3本が1点で交わるときの弦の数 */
const CONCURRENT_CHORD_COUNT = 3;
/** 3本が1点で交わるときの交点数（k = 3 本が通るので k − 1） */
const CONCURRENT_INTERSECTION_COUNT = 2;
/** 矩形に2回出入りする線の弦の数 */
const REENTRANT_CHORD_COUNT = 2;
/** 矩形に2回出入りする線の区画数 */
const REENTRANT_REGION_COUNT = 3;
/** 矩形に2回出入りする線の上側の y 座標 */
const REENTRANT_UPPER = 80;
/** 矩形に2回出入りする線の下側の y 座標 */
const REENTRANT_LOWER = 20;

const RECT: RectSize = { width: SIDE, height: SIDE };

/**
 * ポリラインを生成
 *
 * @param id ポリラインの ID
 * @param points 順につなぐ頂点
 * @returns ポリライン
 */
function line(id: string, ...points: [number, number][]): Polyline {
	return { id, vertices: points.map(([x, y]): Point => ({ x, y })) };
}

/**
 * 分割を実行し、成功した結果を取り出す
 *
 * @param polylines ポリライン
 * @returns 分割結果
 */
function run(polylines: Polyline[]): PartitionResult {
	const outcome: PartitionOutcome = partition({ polylines, rect: RECT, epsilon: DEFAULT_EPSILON });
	if (!outcome.ok) throw new Error('分割に失敗した');
	return outcome.result;
}

/** 左右に抜ける水平線 */
const HORIZONTAL = line('h', [-OVER, MID], [OUTER, MID]);
/** 上下に抜ける垂直線 */
const VERTICAL = line('v', [MID, -OVER], [MID, OUTER]);
/** 左下から右上へ抜ける斜めの線（矩形の角を通る） */
const DIAGONAL = line('d', [-OVER, -OVER], [OUTER, OUTER]);

describe('区画分割', () => {
	describe('正常系', () => {
		it('ポリラインが0本なら、矩形全体が1区画になる', () => {
			const { regions } = run([]);

			expect(regions).toHaveLength(1);
			expect(regions[0].area).toBeCloseTo(RECT_AREA);
		});

		it('1本の線で2区画に分かれる', () => {
			expect(run([HORIZONTAL]).regions).toHaveLength(2);
		});

		it('2本を十字に交差させると4区画になる', () => {
			const { regions, stats } = run([HORIZONTAL, VERTICAL]);

			expect(regions).toHaveLength(CROSS_REGION_COUNT);
			expect(stats.polylineCount).toBe(2);
			expect(stats.chordCount).toBe(2);
			expect(stats.intersectionCount).toBe(1);
		});

		it('区画は重心の y、x の順に番号が振られる', () => {
			const { regions } = run([HORIZONTAL, VERTICAL]);

			const centers = regions.map((region) => ({
				x: region.polygon.reduce((sum, p) => sum + p.x, 0) / region.polygon.length,
				y: region.polygon.reduce((sum, p) => sum + p.y, 0) / region.polygon.length
			}));
			expect(centers.map((c) => [c.x < MID, c.y < MID])).toEqual([
				[true, true],
				[false, true],
				[true, false],
				[false, false]
			]);
			expect(regions.map((region) => region.id)).toEqual([0, 1, 2, LAST_REGION_ID]);
		});

		it('3つの検算がすべて成立する', () => {
			const { stats } = run([HORIZONTAL, VERTICAL]);

			expect(stats.checks).toEqual({ euler: true, chordFormula: true, areaSum: true });
		});
	});

	describe('異常系', () => {
		it('始点が矩形の内部にあるポリラインを含むと、実行を拒否する', () => {
			const outcome = partition({
				polylines: [line('bad', [MID, MID], [OUTER, MID])],
				rect: RECT,
				epsilon: DEFAULT_EPSILON
			});

			expect(outcome.ok).toBe(false);
			if (outcome.ok) return;
			expect(outcome.invalidPolylines.map((entry) => entry.polylineId)).toEqual(['bad']);
		});
	});

	describe('境界条件', () => {
		it('矩形の角を通る斜めの線でも2区画になる', () => {
			const { regions, stats } = run([DIAGONAL]);

			expect(regions).toHaveLength(2);
			expect(stats.checks.areaSum).toBe(true);
		});

		it('3本が1点で交わると、区画数・弦数・交点数が式に一致する', () => {
			const { regions, stats } = run([HORIZONTAL, VERTICAL, DIAGONAL]);

			expect(regions).toHaveLength(CONCURRENT_REGION_COUNT);
			expect(stats.chordCount).toBe(CONCURRENT_CHORD_COUNT);
			expect(stats.intersectionCount).toBe(CONCURRENT_INTERSECTION_COUNT);
			expect(stats.checks.chordFormula).toBe(true);
		});

		it('境界に沿う部分と内部を通る部分を持つ線でも、区画に分かれる', () => {
			const { regions, stats } = run([
				line('edge', [-OVER, 0], [MID, 0], [MID, MID], [OUTER, MID])
			]);

			expect(regions).toHaveLength(2);
			expect(stats.chordCount).toBe(1);
			// 境界との共線の重なりがあるので、弦・交点の式は検算しない
			expect(stats.checks.chordFormula).toBeNull();
		});

		it('同じ線を重ねて置いても、区画数は1本のときと変わらない', () => {
			const { regions } = run([HORIZONTAL, { ...HORIZONTAL, id: 'h2' }]);

			expect(regions).toHaveLength(2);
		});

		it('矩形に2回出入りする線は、弦数が本数より多くなる', () => {
			const { regions, stats } = run([
				line(
					'u',
					[-OVER, REENTRANT_LOWER],
					[OUTER, REENTRANT_LOWER],
					[OUTER, REENTRANT_UPPER],
					[-OVER, REENTRANT_UPPER]
				)
			]);

			expect(stats.polylineCount).toBe(1);
			expect(stats.chordCount).toBe(REENTRANT_CHORD_COUNT);
			expect(regions).toHaveLength(REENTRANT_REGION_COUNT);
			expect(stats.checks.chordFormula).toBe(true);
		});
	});
});
