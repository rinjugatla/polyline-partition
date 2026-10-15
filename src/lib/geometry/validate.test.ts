import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON, MAX_COORDINATE } from '../constants';
import {
	isPointWithinCoordinateLimit,
	validatePolyline,
	type RuleId,
	type ValidationResult
} from './validate';
import type { Point, RectSize } from './types';

/** テスト用の基礎矩形 */
const RECT: RectSize = { width: 100, height: 100 };
/** 矩形の中ほどの座標 */
const MID = 50;
/** 矩形の外側に出た量 */
const OUT = 20;
/** 矩形の内側に入った量 */
const IN = 20;
/** 折れ線の途中の頂点の座標 */
const BEND = 70;
/** ε を十分に超える短い距離 */
const SHORT = 5;
/** 矩形からさらに遠い外側の距離 */
const FAR_OUT = 60;
/** 2進数で正確に表せ、座標の加減算で誤差が出ない ε（ちょうど ε の境界条件用） */
const EXACT_EPSILON = 0.5;

/** 矩形を左から右へ横切る、有効なポリライン */
const VALID_VERTICES: readonly Point[] = [
	{ x: -OUT, y: MID },
	{ x: RECT.width + OUT, y: MID }
];

/**
 * 検証して、違反した規則の ID を取り出す
 *
 * @param vertices 検証する頂点
 * @param rules 検査する規則。省略すると全規則
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 違反した規則の ID の一覧。有効なら空
 */
function violatedRules(
	vertices: readonly Point[],
	rules?: readonly RuleId[],
	epsilon: number = DEFAULT_EPSILON
): RuleId[] {
	const result: ValidationResult = validatePolyline({ vertices, rect: RECT, epsilon, rules });
	return result.ok ? [] : result.violations.map((violation) => violation.rule);
}

describe('ポリラインの入力検証', () => {
	describe('正常系', () => {
		it('矩形を横切る有効なポリラインを受理する', () => {
			const result = validatePolyline({
				vertices: VALID_VERTICES,
				rect: RECT,
				epsilon: DEFAULT_EPSILON
			});

			expect(result).toEqual({ ok: true });
		});

		it('途中で折れ曲がる有効なポリラインを受理する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MID, y: BEND },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('違反には日本語の理由が付く', () => {
			const result = validatePolyline({
				vertices: [{ x: -OUT, y: MID }],
				rect: RECT,
				epsilon: DEFAULT_EPSILON
			});

			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.violations[0].message).toMatch(/頂点/);
		});

		it('検査する規則を指定すると、指定外の規則の違反は無視する', () => {
			const insideStart: Point[] = [
				{ x: MID, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(insideStart, ['V-01', 'V-02'])).toEqual([]);
		});
	});

	describe('異常系', () => {
		it('V-01: 頂点が1個のポリラインを拒否する', () => {
			expect(violatedRules([{ x: -OUT, y: MID }])).toEqual(['V-01']);
		});

		it('V-01: 頂点が0個のポリラインを拒否する', () => {
			expect(violatedRules([])).toEqual(['V-01']);
		});

		it('V-02: 連続する同一頂点を拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: -OUT, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-02');
		});

		it('V-03: 始点が矩形の内部にあるポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: IN, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-03');
		});

		it('V-03: 終点が矩形の内部にあるポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: RECT.width - IN, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-03');
		});

		it('V-04: 自己交差するポリラインを拒否する', () => {
			// 蝶ネクタイの形で、1本目と4本目の線分が交差する
			const vertices: Point[] = [
				{ x: -OUT, y: SHORT },
				{ x: BEND, y: SHORT },
				{ x: SHORT, y: BEND },
				{ x: BEND, y: BEND },
				{ x: BEND, y: -OUT }
			];

			expect(violatedRules(vertices)).toContain('V-04');
		});

		it('V-04: 頂点で折り返して前の線分に重なるポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MID, y: MID },
				{ x: IN, y: MID },
				{ x: -OUT, y: BEND }
			];

			expect(violatedRules(vertices)).toContain('V-04');
		});

		it('V-04: 隣り合わない線分が共線で重なるポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MID, y: MID },
				{ x: MID, y: BEND },
				{ x: IN, y: BEND },
				{ x: IN, y: MID },
				{ x: BEND, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-04');
		});

		it('V-05: 座標の範囲外にある頂点を拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MAX_COORDINATE + 1, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-05');
		});

		it('V-05: 座標が有限でない頂点を拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: Number.NaN, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-05');
		});

		it('V-06: 矩形と全く交わらないポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: -OUT },
				{ x: -OUT, y: RECT.height + OUT }
			];

			expect(violatedRules(vertices)).toEqual(['V-06']);
		});

		it('V-06: 角をかすめるだけのポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -SHORT, y: SHORT },
				{ x: SHORT, y: -SHORT }
			];

			expect(violatedRules(vertices)).toEqual(['V-06']);
		});

		it('V-06: 境界線の上だけにあるポリラインを拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: 0 },
				{ x: RECT.width + OUT, y: 0 }
			];

			expect(violatedRules(vertices)).toEqual(['V-06']);
		});

		it('複数の規則に違反するときは、すべての違反を返す', () => {
			const vertices: Point[] = [
				{ x: MID, y: MID },
				{ x: MID, y: MID }
			];

			expect(violatedRules(vertices)).toEqual(expect.arrayContaining(['V-02', 'V-03']));
		});
	});

	describe('境界条件', () => {
		it('V-03: 始点が矩形の境界上にあると拒否する', () => {
			const vertices: Point[] = [
				{ x: 0, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-03');
		});

		it('V-03: 始点が境界から ε ちょうど外側にあると拒否する', () => {
			const vertices: Point[] = [
				{ x: -DEFAULT_EPSILON, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-03');
		});

		it('V-03: 始点が境界から ε をわずかに超えて外側にあると受理する', () => {
			const vertices: Point[] = [
				{ x: -DEFAULT_EPSILON * 2, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('V-02: 連続する2頂点の距離がちょうど ε だと拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: -OUT + EXACT_EPSILON, y: MID },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices, undefined, EXACT_EPSILON)).toContain('V-02');
		});

		it('V-04: 長さ0の線分をはさんだ隣の線分は、V-02 とは別に自己接触として報告しない', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MID, y: MID },
				{ x: MID + EXACT_EPSILON, y: MID },
				{ x: RECT.width + OUT, y: MID + SHORT }
			];

			expect(violatedRules(vertices, undefined, EXACT_EPSILON)).toEqual(['V-02']);
		});

		it('V-04: 隣接する線分が共有頂点だけで接するポリラインを受理する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: MID, y: BEND },
				{ x: BEND, y: MID },
				{ x: RECT.width + OUT, y: IN }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('V-04: 隣り合わない線分の距離がちょうど ε だと拒否する', () => {
			// 3本目の線分が1本目に ε ちょうどまで近づく
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: BEND, y: MID },
				{ x: BEND, y: MID + SHORT },
				{ x: MID, y: MID + SHORT },
				{ x: MID, y: MID + EXACT_EPSILON }
			];

			expect(violatedRules(vertices, undefined, EXACT_EPSILON)).toContain('V-04');
		});

		it('V-04: 矩形の外側での自己交差も拒否する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: MID },
				{ x: -OUT * 2, y: MID },
				{ x: -OUT * 2, y: BEND },
				{ x: -OUT / 2, y: BEND },
				{ x: -OUT / 2, y: SHORT },
				{ x: -FAR_OUT, y: SHORT },
				{ x: -FAR_OUT, y: MID + SHORT },
				{ x: RECT.width + OUT, y: MID }
			];

			expect(violatedRules(vertices)).toContain('V-04');
		});

		it('V-05: 座標が上限ちょうどの頂点を受理する', () => {
			const vertices: Point[] = [
				{ x: -MAX_COORDINATE, y: MID },
				{ x: MAX_COORDINATE, y: MID }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('V-05: 座標が下限ちょうどの頂点を受理する', () => {
			const vertices: Point[] = [
				{ x: MID, y: -MAX_COORDINATE },
				{ x: MID, y: MAX_COORDINATE }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('V-06: 境界に沿う部分と内部を通る部分の両方を持つポリラインを受理する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: 0 },
				{ x: MID, y: 0 },
				{ x: MID, y: -OUT },
				{ x: BEND, y: -OUT },
				{ x: BEND, y: RECT.height + OUT }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});

		it('V-06: 矩形に複数回出入りするポリラインを受理する', () => {
			const vertices: Point[] = [
				{ x: -OUT, y: IN },
				{ x: RECT.width + OUT, y: IN },
				{ x: RECT.width + OUT, y: BEND },
				{ x: -OUT, y: BEND }
			];

			expect(violatedRules(vertices)).toEqual([]);
		});
	});
});

describe('座標の範囲判定（V-05）', () => {
	describe('正常系', () => {
		it('x, y とも範囲内の点は true を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MID, y: -MID })).toBe(true);
		});
	});

	describe('異常系', () => {
		it('x が NaN の点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: Number.NaN, y: MID })).toBe(false);
		});

		it('y が NaN の点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MID, y: Number.NaN })).toBe(false);
		});

		it('x が Infinity の点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: Number.POSITIVE_INFINITY, y: MID })).toBe(false);
		});

		it('y が -Infinity の点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MID, y: Number.NEGATIVE_INFINITY })).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('x, y がちょうど +MAX_COORDINATE の点は true を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MAX_COORDINATE, y: MAX_COORDINATE })).toBe(true);
		});

		it('x, y がちょうど -MAX_COORDINATE の点は true を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: -MAX_COORDINATE, y: -MAX_COORDINATE })).toBe(true);
		});

		it('x が MAX_COORDINATE を超える点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MAX_COORDINATE + 1, y: MID })).toBe(false);
		});

		it('y が -MAX_COORDINATE を下回る点は false を返す', () => {
			expect(isPointWithinCoordinateLimit({ x: MID, y: -MAX_COORDINATE - 1 })).toBe(false);
		});
	});
});
