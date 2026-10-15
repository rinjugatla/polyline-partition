import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import { collectSegments, nodeSegments, removeOutsideSegments } from './noding';
import type { Polyline, RectSize, Segment } from './types';

/** 座標の比較に使う小数点以下の桁数 */
const COORDINATE_PRECISION = 9;

/** テスト用の基礎矩形 */
const RECT: RectSize = { width: 100, height: 100 };
/** 基礎矩形の辺の数 */
const RECT_SIDE_COUNT = 4;
/** 線分の端の座標（始点側） */
const NEAR = 0;
/** 線分の中ほどの座標 */
const MID = 5;
/** 線分の端の座標（終点側） */
const FAR = 10;
/** 共線で重なる線分の終点 */
const OVERLAP_END = 15;
/** 十字の交差の分割数（2本が互いを2つに分ける） */
const CROSS_PIECE_COUNT = 4;
/** 3本が1点で交わるときの分割数 */
const TRIPLE_PIECE_COUNT = 6;
/** 一方が他方に含まれる共線の重なりの分割数（外側が3つ、内側が1つ） */
const NESTED_PIECE_COUNT = 4;
/** 矩形の外側に出た量 */
const OUT = 20;
/** 矩形の内側に入った量 */
const IN = 30;
/** 離れた線分の間隔 */
const GAP = 3;
/** 2進数で正確に表せ、座標の加減算で誤差が出ない ε（ちょうど ε の境界条件用） */
const EXACT_EPSILON = 0.5;
/** ほぼ共線とみなせるずれ（EXACT_EPSILON の半分） */
const SMALL_OFFSET = 0.25;
/** ε をわずかに超える線分の長さ */
const BEYOND_EPSILON_LENGTH = 0.75;
/** 斜めの線分の端の高さ */
const SLOPE_RISE = 5;
/** 斜めに交わる点の高さ */
const SLOPE_CROSS_Y = 2.5;
/** ε の半分（ε 以内のずれを作る） */
const HALF = 0.5;

/**
 * 線分を作る
 *
 * @param x1 始点の x
 * @param y1 始点の y
 * @param x2 終点の x
 * @param y2 終点の y
 * @returns 線分
 */
function seg(x1: number, y1: number, x2: number, y2: number): Segment {
	return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
}

/**
 * 線分の列がほぼ等しいことを確かめる
 *
 * @param actual 実際の線分の列
 * @param expected 期待する線分の列
 */
function expectSegmentsClose(actual: readonly Segment[], expected: readonly Segment[]): void {
	expect(actual).toHaveLength(expected.length);
	for (const [index, want] of expected.entries()) {
		expect(actual[index].start.x).toBeCloseTo(want.start.x, COORDINATE_PRECISION);
		expect(actual[index].start.y).toBeCloseTo(want.start.y, COORDINATE_PRECISION);
		expect(actual[index].end.x).toBeCloseTo(want.end.x, COORDINATE_PRECISION);
		expect(actual[index].end.y).toBeCloseTo(want.end.y, COORDINATE_PRECISION);
	}
}

describe('線分の収集', () => {
	describe('正常系', () => {
		it('ポリラインの線分と矩形の4辺を集める', () => {
			const polylines: Polyline[] = [
				{
					id: 'a',
					vertices: [
						{ x: -OUT, y: MID },
						{ x: MID, y: MID },
						{ x: RECT.width + OUT, y: IN }
					]
				}
			];

			const segments = collectSegments(polylines, RECT);

			expect(segments).toHaveLength(2 + RECT_SIDE_COUNT);
		});
	});

	describe('異常系', () => {
		it('ポリラインが0本でも矩形の4辺を返す', () => {
			expect(collectSegments([], RECT)).toHaveLength(RECT_SIDE_COUNT);
		});
	});

	describe('境界条件', () => {
		it('頂点が1個のポリラインは線分を作らない', () => {
			const polylines: Polyline[] = [{ id: 'a', vertices: [{ x: MID, y: MID }] }];

			expect(collectSegments(polylines, RECT)).toHaveLength(RECT_SIDE_COUNT);
		});

		it('矩形の4辺が閉じた周を作る', () => {
			const [bottom, right, top, left] = collectSegments([], RECT);

			expect(bottom.end).toEqual(right.start);
			expect(right.end).toEqual(top.start);
			expect(top.end).toEqual(left.start);
			expect(left.end).toEqual(bottom.start);
		});
	});
});

describe('ノーディング', () => {
	describe('正常系', () => {
		it('小線分ごとに、由来する入力の線分の添字を返す', () => {
			const degenerate = seg(NEAR, NEAR, NEAR, NEAR);
			const horizontal = seg(NEAR, MID, FAR, MID);
			const vertical = seg(MID, NEAR, MID, FAR);

			const result = nodeSegments([degenerate, horizontal, vertical], DEFAULT_EPSILON);

			// 長さ0の線分(添字0)は無視され、十字の2本が2つずつに分かれる
			expect(result.sourceIndices).toEqual([1, 1, 2, 2]);
		});

		it('十字に交差する2本の線分を4つの小線分に分ける', () => {
			const horizontal = seg(NEAR, MID, FAR, MID);
			const vertical = seg(MID, NEAR, MID, FAR);

			const result = nodeSegments([horizontal, vertical], DEFAULT_EPSILON);

			expect(result.segments).toHaveLength(CROSS_PIECE_COUNT);
			expectSegmentsClose(result.segments, [
				seg(NEAR, MID, MID, MID),
				seg(MID, MID, FAR, MID),
				seg(MID, NEAR, MID, MID),
				seg(MID, MID, MID, FAR)
			]);
			expect(result.hasCollinearOverlap).toBe(false);
		});

		it('T字の接触では、棒を受ける側だけが分かれる', () => {
			const bar = seg(NEAR, NEAR, FAR, NEAR);
			const stem = seg(MID, NEAR, MID, FAR);

			const result = nodeSegments([bar, stem], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [
				seg(NEAR, NEAR, MID, NEAR),
				seg(MID, NEAR, FAR, NEAR),
				seg(MID, NEAR, MID, FAR)
			]);
		});

		it('交わらない線分は分割せずそのまま返す', () => {
			const first = seg(NEAR, NEAR, FAR, NEAR);
			const second = seg(NEAR, GAP, FAR, GAP);

			const result = nodeSegments([first, second], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [first, second]);
		});
	});

	describe('異常系', () => {
		it('入力が空なら空を返す', () => {
			const result = nodeSegments([], DEFAULT_EPSILON);

			expect(result.segments).toEqual([]);
			expect(result.hasCollinearOverlap).toBe(false);
		});

		it('長さ0の線分は無視する', () => {
			const degenerate = seg(MID, MID, MID, MID);
			const normal = seg(NEAR, MID, FAR, MID);

			const result = nodeSegments([degenerate, normal], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [normal]);
		});

		it('長さが ε 以下の線分も長さ0として無視する', () => {
			const tiny = seg(MID, MID, MID + DEFAULT_EPSILON, MID);
			const normal = seg(NEAR, GAP, FAR, GAP);

			const result = nodeSegments([tiny, normal], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [normal]);
		});
	});

	describe('境界条件', () => {
		it('3本が1点で交わると、それぞれが2つに分かれて6つの小線分になる', () => {
			const horizontal = seg(NEAR, MID, FAR, MID);
			const vertical = seg(MID, NEAR, MID, FAR);
			const diagonal = seg(NEAR, NEAR, FAR, FAR);

			const result = nodeSegments([horizontal, vertical, diagonal], DEFAULT_EPSILON);

			expect(result.segments).toHaveLength(TRIPLE_PIECE_COUNT);
		});

		it('共線で部分的に重なる2線分は、重なり区間の両端点で分かれ、重なりを記録する', () => {
			const first = seg(NEAR, NEAR, FAR, NEAR);
			const second = seg(MID, NEAR, OVERLAP_END, NEAR);

			const result = nodeSegments([first, second], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [
				seg(NEAR, NEAR, MID, NEAR),
				seg(MID, NEAR, FAR, NEAR),
				seg(MID, NEAR, FAR, NEAR),
				seg(FAR, NEAR, OVERLAP_END, NEAR)
			]);
			expect(result.hasCollinearOverlap).toBe(true);
		});

		it('一方が他方に完全に含まれる共線の重なりも記録する', () => {
			const outer = seg(NEAR, NEAR, OVERLAP_END, NEAR);
			const inner = seg(MID, NEAR, FAR, NEAR);

			const result = nodeSegments([outer, inner], DEFAULT_EPSILON);

			expect(result.segments).toHaveLength(NESTED_PIECE_COUNT);
			expect(result.hasCollinearOverlap).toBe(true);
		});

		it('共線で端点だけが接する2線分は、分割せず重なりも記録しない', () => {
			const first = seg(NEAR, NEAR, MID, NEAR);
			const second = seg(MID, NEAR, FAR, NEAR);

			const result = nodeSegments([first, second], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [first, second]);
			expect(result.hasCollinearOverlap).toBe(false);
		});

		it('斜めに交わる2本の線分を、交点の座標で4つの小線分に分ける', () => {
			const rising = seg(NEAR, NEAR, FAR, SLOPE_RISE);
			const falling = seg(NEAR, SLOPE_RISE, FAR, NEAR);

			const result = nodeSegments([rising, falling], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [
				seg(NEAR, NEAR, MID, SLOPE_CROSS_Y),
				seg(MID, SLOPE_CROSS_Y, FAR, SLOPE_RISE),
				seg(NEAR, SLOPE_RISE, MID, SLOPE_CROSS_Y),
				seg(MID, SLOPE_CROSS_Y, FAR, NEAR)
			]);
		});

		it('長さがちょうど ε の線分は無視する', () => {
			const exact = seg(MID, MID, MID + EXACT_EPSILON, MID);

			const result = nodeSegments([exact], EXACT_EPSILON);

			expect(result.segments).toEqual([]);
		});

		it('長さが ε をわずかに超える線分は無視しない', () => {
			const beyond = seg(MID, MID, MID + BEYOND_EPSILON_LENGTH, MID);

			const result = nodeSegments([beyond], EXACT_EPSILON);

			expect(result.segments).toEqual([beyond]);
		});

		it('ε 以内のずれで平行に重なる2線分も、共線の重なりとして記録する', () => {
			const first = seg(NEAR, NEAR, FAR, NEAR);
			const second = seg(MID, SMALL_OFFSET, OVERLAP_END, SMALL_OFFSET);

			const result = nodeSegments([first, second], EXACT_EPSILON);

			expect(result.segments).toHaveLength(NESTED_PIECE_COUNT);
			expect(result.hasCollinearOverlap).toBe(true);
		});

		it('同じ線分が2回入ると、同じ小線分が2本出力され、重なりを記録する', () => {
			const line = seg(NEAR, NEAR, FAR, NEAR);

			const result = nodeSegments([line, line], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [line, line]);
			expect(result.hasCollinearOverlap).toBe(true);
		});

		it('端点どうしで接するL字は分割せず、重なりも記録しない', () => {
			const first = seg(NEAR, NEAR, MID, NEAR);
			const second = seg(MID, NEAR, MID, MID);

			const result = nodeSegments([first, second], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [first, second]);
			expect(result.hasCollinearOverlap).toBe(false);
		});

		it('端点が他方の線分上にあるときは、その点で他方を分ける', () => {
			const bar = seg(NEAR, NEAR, FAR, NEAR);
			const stem = seg(MID, NEAR, MID, FAR);

			const result = nodeSegments([stem, bar], DEFAULT_EPSILON);

			expectSegmentsClose(result.segments, [
				seg(MID, NEAR, MID, FAR),
				seg(NEAR, NEAR, MID, NEAR),
				seg(MID, NEAR, FAR, NEAR)
			]);
		});

		it('端点が他方の線分から ε 以内の位置にあるときも、その端点で分ける', () => {
			const bar = seg(NEAR, NEAR, FAR, NEAR);
			const stem = seg(MID, HALF, MID, FAR);

			const result = nodeSegments([bar, stem], HALF);

			expectSegmentsClose(result.segments, [
				seg(NEAR, NEAR, MID, HALF),
				seg(MID, HALF, FAR, NEAR),
				stem
			]);
		});
	});
});

describe('矩形外の除去', () => {
	describe('正常系', () => {
		it('矩形の内部にある小線分を残す', () => {
			const inside = seg(IN, IN, IN * 2, IN);

			expect(removeOutsideSegments([inside], RECT, DEFAULT_EPSILON)).toEqual([inside]);
		});

		it('矩形の外側にある小線分を捨てる', () => {
			const outside = seg(-OUT, MID, -MID, MID);

			expect(removeOutsideSegments([outside], RECT, DEFAULT_EPSILON)).toEqual([]);
		});
	});

	describe('異常系', () => {
		it('入力が空なら空を返す', () => {
			expect(removeOutsideSegments([], RECT, DEFAULT_EPSILON)).toEqual([]);
		});
	});

	describe('境界条件', () => {
		it('境界上にある小線分は残す', () => {
			const onBoundary = seg(NEAR, NEAR, RECT.width, NEAR);

			expect(removeOutsideSegments([onBoundary], RECT, DEFAULT_EPSILON)).toEqual([onBoundary]);
		});

		it('中点が境界からちょうど ε 外側にある小線分は残す', () => {
			const justOutside = seg(-DEFAULT_EPSILON, NEAR, -DEFAULT_EPSILON, FAR);

			expect(removeOutsideSegments([justOutside], RECT, DEFAULT_EPSILON)).toEqual([justOutside]);
		});

		it('中点が境界から ε をわずかに超えて外側にある小線分は捨てる', () => {
			const beyond = seg(-DEFAULT_EPSILON * 2, NEAR, -DEFAULT_EPSILON * 2, FAR);

			expect(removeOutsideSegments([beyond], RECT, DEFAULT_EPSILON)).toEqual([]);
		});

		it('矩形を貫く線分を分けた後は、外側の小線分だけが捨てられる', () => {
			const through = seg(-OUT, MID, RECT.width + OUT, MID);

			const noded = nodeSegments([through, ...collectSegments([], RECT)], DEFAULT_EPSILON);
			const kept = removeOutsideSegments(noded.segments, RECT, DEFAULT_EPSILON);

			// 貫く線分は左右の境界で3つに分かれ、矩形の内側の1つだけが残る
			const insideThrough = kept.filter(
				(piece) =>
					Math.abs(piece.start.y - MID) <= DEFAULT_EPSILON &&
					Math.abs(piece.end.y - MID) <= DEFAULT_EPSILON
			);
			expect(insideThrough).toHaveLength(1);
		});
	});
});
