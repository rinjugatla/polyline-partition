import fc from 'fast-check';
import { describe, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import { partition } from './partition';
import type { Point, RectSize } from './types';
import { validatePolyline } from './validate';

/** 乱数のシード（再現できるよう固定） */
const SEED = 20260101;
/** 試行回数 */
const RUNS = 200;
/** 基礎矩形の辺の長さ */
const SIDE = 100;
/** 矩形の外側へはみ出す距離 */
const OVER = 10;
/** 途中の頂点の個数の上限 */
const MAX_MIDDLE_VERTICES = 4;
/** 一般位置（3本以上が1点で交わらず、共線の重なりもない）とみなす座標の刻み */
const COORDINATE_STEP = 0.37;

const RECT: RectSize = { width: SIDE, height: SIDE };

/** 矩形の周りの外側の点（始点と終点用） */
const outsidePoint: fc.Arbitrary<Point> = fc.oneof(
	fc.record({ x: fc.integer({ min: -OVER, max: -1 }), y: fc.integer({ min: 0, max: SIDE }) }),
	fc.record({
		x: fc.integer({ min: SIDE + 1, max: SIDE + OVER }),
		y: fc.integer({ min: 0, max: SIDE })
	}),
	fc.record({ x: fc.integer({ min: 0, max: SIDE }), y: fc.integer({ min: -OVER, max: -1 }) }),
	fc.record({
		x: fc.integer({ min: 0, max: SIDE }),
		y: fc.integer({ min: SIDE + 1, max: SIDE + OVER })
	})
);

/** 矩形の内部の途中の頂点（刻みを半端な値にして、偶然の共線や接触を避ける） */
const innerPoint: fc.Arbitrary<Point> = fc
	.record({ x: fc.integer({ min: 5, max: 270 }), y: fc.integer({ min: 5, max: 270 }) })
	.map(({ x, y }) => ({ x: x * COORDINATE_STEP, y: y * COORDINATE_STEP }));

/** 検証を通るポリラインだけを生成（通らないものは棄却） */
const validVertices: fc.Arbitrary<Point[]> = fc
	.tuple(outsidePoint, fc.array(innerPoint, { maxLength: MAX_MIDDLE_VERTICES }), outsidePoint)
	.map(([start, middle, end]) => [start, ...middle, end])
	.filter((vertices) => validatePolyline({ vertices, rect: RECT, epsilon: DEFAULT_EPSILON }).ok);

describe('区画分割のプロパティ', () => {
	describe('正常系', () => {
		it('面積の総和が W × H に一致し、オイラーの検算が成立する', () => {
			fc.assert(
				fc.property(fc.array(validVertices, { maxLength: 3 }), (list) => {
					const polylines = list.map((vertices, index) => ({ id: `p${index}`, vertices }));
					const outcome = partition({ polylines, rect: RECT, epsilon: DEFAULT_EPSILON });
					if (!outcome.ok) return false;

					const { checks } = outcome.result.stats;
					return checks.areaSum && checks.euler && checks.chordFormula !== false;
				}),
				{ seed: SEED, numRuns: RUNS }
			);
		});
	});
});
