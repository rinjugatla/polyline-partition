import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import {
	areSegmentsCollinear,
	distanceBetween,
	distancePointToLine,
	distancePointToSegment,
	distanceToRect,
	findLineIntersection,
	findSegmentIntersection,
	isPointNearSegment,
	isSamePoint,
	passesThroughRectInterior,
	pointAt,
	segmentDistance,
	signedArea
} from './primitives';
import type { Point, RectSize, Segment } from './types';

/** 座標の比較に使う小数点以下の桁数 */
const COORDINATE_PRECISION = 9;

/** テスト用の基礎矩形 */
const RECT: RectSize = { width: 100, height: 50 };

/** 3-4-5 の直角三角形の短辺 */
const SHORT_SIDE = 3;
/** 3-4-5 の直角三角形の長辺 */
const LONG_SIDE = 4;
/** 3-4-5 の直角三角形の斜辺 */
const HYPOTENUSE = 5;

/** 水平な線分の長さ */
const HORIZONTAL_LENGTH = 10;
/** 線分の中点の x 座標 */
const MID_X = 5;
/** 線分から離れた点までの距離 */
const OFFSET = 7;
/** 矩形の外側に出た量 */
const OUTSIDE_OFFSET = 30;
/** 正方形の一辺 */
const SQUARE_SIDE = 4;
/** 正方形の面積 */
const SQUARE_AREA = 16;
/** 斜め線分の端の座標 */
const DIAGONAL_END = 10;
/** 交点の座標（対角線どうしの交点） */
const CROSS_CENTER = 5;
/** ε を超える十分大きな距離 */
const LARGE_DISTANCE = 1;
/** 共線の重なりの区間の終端 */
const OVERLAP_END = 15;
/** 共線の重なりの区間の始端 */
const OVERLAP_START = 5;
/** 矩形内部の中ほどの y 座標 */
const RECT_MID_Y = 25;

/**
 * 水平線分を作る
 *
 * @param fromX 始点の x
 * @param toX 終点の x
 * @param y 線分の y
 * @returns 水平な線分
 */
function horizontal(fromX: number, toX: number, y: number): Segment {
	return { start: { x: fromX, y }, end: { x: toX, y } };
}

/**
 * 座標どうしがほぼ等しいことを確かめる
 *
 * @param actual 実際の点
 * @param expected 期待する点
 */
function expectPointClose(actual: Point | null, expected: Point): void {
	expect(actual).not.toBeNull();
	expect(actual?.x).toBeCloseTo(expected.x, COORDINATE_PRECISION);
	expect(actual?.y).toBeCloseTo(expected.y, COORDINATE_PRECISION);
}

describe('点と点の距離と同一判定', () => {
	describe('正常系', () => {
		it('3-4-5 の直角三角形で距離が斜辺の長さになる', () => {
			const distance = distanceBetween({ x: 0, y: 0 }, { x: SHORT_SIDE, y: LONG_SIDE });

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});

		it('ε より離れた2点は同じ点とみなさない', () => {
			const isSame = isSamePoint({ x: 0, y: 0 }, { x: LARGE_DISTANCE, y: 0 }, DEFAULT_EPSILON);

			expect(isSame).toBe(false);
		});
	});

	describe('異常系', () => {
		it('同じ座標の2点は距離が 0 で同じ点とみなす', () => {
			const point = { x: SHORT_SIDE, y: LONG_SIDE };

			expect(distanceBetween(point, point)).toBe(0);
			expect(isSamePoint(point, point, DEFAULT_EPSILON)).toBe(true);
		});
	});

	describe('境界条件', () => {
		it('距離がちょうど ε の2点は同じ点とみなす', () => {
			const isSame = isSamePoint({ x: 0, y: 0 }, { x: DEFAULT_EPSILON, y: 0 }, DEFAULT_EPSILON);

			expect(isSame).toBe(true);
		});
	});
});

describe('点と線分の距離', () => {
	describe('正常系', () => {
		it('線分の中ほどへの垂線の長さが距離になる', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const distance = distancePointToSegment({ x: MID_X, y: OFFSET }, segment);

			expect(distance).toBeCloseTo(OFFSET, COORDINATE_PRECISION);
		});

		it('垂線の足が線分の外にあるときは近い端点までの距離になる', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const distance = distancePointToSegment(
				{ x: HORIZONTAL_LENGTH + SHORT_SIDE, y: LONG_SIDE },
				segment
			);

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});

	describe('異常系', () => {
		it('長さ0の線分は端点との距離を返す', () => {
			const degenerate = horizontal(MID_X, MID_X, 0);

			const distance = distancePointToSegment({ x: MID_X + SHORT_SIDE, y: LONG_SIDE }, degenerate);

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});

	describe('境界条件', () => {
		it('距離がちょうど ε の点は線分の近くにあるとみなす', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const isNear = isPointNearSegment({ x: MID_X, y: DEFAULT_EPSILON }, segment, DEFAULT_EPSILON);

			expect(isNear).toBe(true);
		});

		it('線分の端点上の点は線分の近くにあるとみなす', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const isNear = isPointNearSegment({ x: HORIZONTAL_LENGTH, y: 0 }, segment, DEFAULT_EPSILON);

			expect(isNear).toBe(true);
		});

		it('ε をわずかに超えた点は線分の近くにないとみなす', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const isNear = isPointNearSegment(
				{ x: MID_X, y: DEFAULT_EPSILON * 2 },
				segment,
				DEFAULT_EPSILON
			);

			expect(isNear).toBe(false);
		});
	});
});

describe('点と基礎矩形の距離', () => {
	describe('正常系', () => {
		it('辺の外側にある点は、その辺までの距離になる', () => {
			const distance = distanceToRect({ x: -SHORT_SIDE, y: RECT_MID_Y }, RECT);

			expect(distance).toBeCloseTo(SHORT_SIDE, COORDINATE_PRECISION);
		});

		it('角の外側にある点は、角までの距離になる', () => {
			const distance = distanceToRect({ x: -SHORT_SIDE, y: -LONG_SIDE }, RECT);

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});

	describe('異常系', () => {
		it('矩形の内部にある点は距離が 0 になる', () => {
			const distance = distanceToRect({ x: MID_X, y: MID_X }, RECT);

			expect(distance).toBe(0);
		});
	});

	describe('境界条件', () => {
		it('境界上の点は距離が 0 になる', () => {
			expect(distanceToRect({ x: 0, y: RECT_MID_Y }, RECT)).toBe(0);
			expect(distanceToRect({ x: RECT.width, y: RECT.height }, RECT)).toBe(0);
		});

		it('右上の外側の点も、各辺からの超過量で距離を求める', () => {
			const distance = distanceToRect(
				{ x: RECT.width + SHORT_SIDE, y: RECT.height + LONG_SIDE },
				RECT
			);

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});
});

describe('線分どうしの交点', () => {
	describe('正常系', () => {
		it('斜めに交差する2本の線分の交点座標を求める', () => {
			const first: Segment = { start: { x: 0, y: 0 }, end: { x: DIAGONAL_END, y: DIAGONAL_END } };
			const second: Segment = { start: { x: 0, y: DIAGONAL_END }, end: { x: DIAGONAL_END, y: 0 } };

			const intersection = findSegmentIntersection(first, second);

			expectPointClose(intersection, { x: CROSS_CENTER, y: CROSS_CENTER });
		});
	});

	describe('異常系', () => {
		it('平行な線分は交点なしになる', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(0, HORIZONTAL_LENGTH, SHORT_SIDE);

			expect(findSegmentIntersection(first, second)).toBeNull();
		});

		it('長さ0の線分は交点なしになる', () => {
			const degenerate = horizontal(MID_X, MID_X, 0);
			const other: Segment = { start: { x: MID_X, y: -MID_X }, end: { x: MID_X, y: MID_X } };

			expect(findSegmentIntersection(degenerate, other)).toBeNull();
		});

		it('直線の交点が線分の外にあるときは交点なしになる', () => {
			const first = horizontal(0, SHORT_SIDE, 0);
			const second: Segment = { start: { x: MID_X, y: -MID_X }, end: { x: MID_X, y: MID_X } };

			expect(findSegmentIntersection(first, second)).toBeNull();
		});
	});

	describe('境界条件', () => {
		it('端点どうしの接触は、その端点を交点として返す', () => {
			const first = horizontal(0, MID_X, 0);
			const second: Segment = { start: { x: MID_X, y: 0 }, end: { x: MID_X, y: MID_X } };

			const intersection = findSegmentIntersection(first, second);

			expectPointClose(intersection, { x: MID_X, y: 0 });
		});

		it('T字の接触は、一方の端点を交点として返す', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second: Segment = { start: { x: MID_X, y: 0 }, end: { x: MID_X, y: MID_X } };

			const intersection = findSegmentIntersection(first, second);

			expectPointClose(intersection, { x: MID_X, y: 0 });
		});

		it('共線で重なる線分は点としては扱わず交点なしになる', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(OVERLAP_START, OVERLAP_END, 0);

			expect(findSegmentIntersection(first, second)).toBeNull();
		});
	});
});

describe('線分どうしの距離', () => {
	describe('正常系', () => {
		it('交差する線分の距離は 0 になる', () => {
			const first: Segment = { start: { x: 0, y: 0 }, end: { x: DIAGONAL_END, y: DIAGONAL_END } };
			const second: Segment = { start: { x: 0, y: DIAGONAL_END }, end: { x: DIAGONAL_END, y: 0 } };

			expect(segmentDistance(first, second)).toBe(0);
		});

		it('平行な線分の距離は間隔になる', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(0, HORIZONTAL_LENGTH, SHORT_SIDE);

			expect(segmentDistance(first, second)).toBeCloseTo(SHORT_SIDE, COORDINATE_PRECISION);
		});
	});

	describe('異常系', () => {
		it('長さ0の線分どうしは点どうしの距離になる', () => {
			const first = horizontal(0, 0, 0);
			const second: Segment = {
				start: { x: SHORT_SIDE, y: LONG_SIDE },
				end: { x: SHORT_SIDE, y: LONG_SIDE }
			};

			expect(segmentDistance(first, second)).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});

	describe('境界条件', () => {
		it('端点どうしが接する線分の距離は 0 になる', () => {
			const first = horizontal(0, MID_X, 0);
			const second: Segment = { start: { x: MID_X, y: 0 }, end: { x: MID_X, y: MID_X } };

			expect(segmentDistance(first, second)).toBe(0);
		});

		it('共線で重なる線分の距離は 0 になる', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(OVERLAP_START, OVERLAP_END, 0);

			expect(segmentDistance(first, second)).toBe(0);
		});

		it('共線で離れた線分の距離は端点間の隙間になる', () => {
			const first = horizontal(0, MID_X, 0);
			const second = horizontal(HORIZONTAL_LENGTH, OVERLAP_END, 0);

			expect(segmentDistance(first, second)).toBeCloseTo(MID_X, COORDINATE_PRECISION);
		});
	});
});

describe('符号付き面積', () => {
	/** 反時計回りの正方形 */
	const counterClockwise: readonly Point[] = [
		{ x: 0, y: 0 },
		{ x: SQUARE_SIDE, y: 0 },
		{ x: SQUARE_SIDE, y: SQUARE_SIDE },
		{ x: 0, y: SQUARE_SIDE }
	];

	describe('正常系', () => {
		it('反時計回りの多角形は正の面積になる', () => {
			expect(signedArea(counterClockwise)).toBeCloseTo(SQUARE_AREA, COORDINATE_PRECISION);
		});

		it('時計回りの多角形は負の面積になる', () => {
			const clockwise = [...counterClockwise].reverse();

			expect(signedArea(clockwise)).toBeCloseTo(-SQUARE_AREA, COORDINATE_PRECISION);
		});
	});

	describe('異常系', () => {
		it('頂点が3個未満のときは面積 0 になる', () => {
			expect(signedArea([])).toBe(0);
			expect(
				signedArea([
					{ x: 0, y: 0 },
					{ x: 1, y: 1 }
				])
			).toBe(0);
		});
	});

	describe('境界条件', () => {
		it('同一直線上の頂点だけの多角形は面積 0 になる', () => {
			const collinear: readonly Point[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: SHORT_SIDE, y: SHORT_SIDE }
			];

			expect(signedArea(collinear)).toBe(0);
		});

		it('始点を変えても面積は変わらない', () => {
			const rotated = [...counterClockwise.slice(2), ...counterClockwise.slice(0, 2)];

			expect(signedArea(rotated)).toBeCloseTo(SQUARE_AREA, COORDINATE_PRECISION);
		});
	});
});

describe('線分が矩形の内部を通るか', () => {
	describe('正常系', () => {
		it('矩形を横切る線分は内部を通る', () => {
			const segment = horizontal(-OUTSIDE_OFFSET, RECT.width + OUTSIDE_OFFSET, RECT_MID_Y);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(true);
		});

		it('矩形の内部に完全に収まる線分は内部を通る', () => {
			const segment = horizontal(MID_X, HORIZONTAL_LENGTH, RECT_MID_Y);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(true);
		});
	});

	describe('異常系', () => {
		it('矩形と全く交わらない線分は内部を通らない', () => {
			const segment = horizontal(-OUTSIDE_OFFSET, -MID_X, RECT_MID_Y);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(false);
		});

		it('角をかすめるだけの線分は内部を通らない', () => {
			const segment: Segment = {
				start: { x: -HORIZONTAL_LENGTH, y: HORIZONTAL_LENGTH },
				end: { x: HORIZONTAL_LENGTH, y: -HORIZONTAL_LENGTH }
			};

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('境界線の上だけにある線分は内部を通らない', () => {
			const segment = horizontal(-OUTSIDE_OFFSET, RECT.width + OUTSIDE_OFFSET, 0);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(false);
		});

		it('境界から ε 以内の帯を走る線分は内部を通らない', () => {
			const segment = horizontal(-OUTSIDE_OFFSET, RECT.width + OUTSIDE_OFFSET, DEFAULT_EPSILON);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(false);
		});

		it('境界から ε をわずかに超えて内側を走る線分は内部を通る', () => {
			const segment = horizontal(-OUTSIDE_OFFSET, RECT.width + OUTSIDE_OFFSET, DEFAULT_EPSILON * 2);

			expect(passesThroughRectInterior(segment, RECT, DEFAULT_EPSILON)).toBe(true);
		});
	});
});

describe('点と直線の距離', () => {
	describe('正常系', () => {
		it('線分の延長線上にある点も、直線までの垂線の長さが距離になる', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			const distance = distancePointToLine({ x: HORIZONTAL_LENGTH * 2, y: OFFSET }, segment);

			expect(distance).toBeCloseTo(OFFSET, COORDINATE_PRECISION);
		});
	});

	describe('異常系', () => {
		it('長さ0の線分は端点との距離を返す', () => {
			const degenerate = horizontal(MID_X, MID_X, 0);

			const distance = distancePointToLine({ x: MID_X + SHORT_SIDE, y: LONG_SIDE }, degenerate);

			expect(distance).toBeCloseTo(HYPOTENUSE, COORDINATE_PRECISION);
		});
	});

	describe('境界条件', () => {
		it('直線上の点は距離が 0 になる', () => {
			const segment = horizontal(0, HORIZONTAL_LENGTH, 0);

			expect(distancePointToLine({ x: -OFFSET, y: 0 }, segment)).toBe(0);
		});
	});
});

describe('直線どうしの交点', () => {
	describe('正常系', () => {
		it('線分の範囲外でも、延長した直線どうしの交点を返す', () => {
			const first = horizontal(0, SHORT_SIDE, 0);
			const second: Segment = {
				start: { x: MID_X, y: SHORT_SIDE },
				end: { x: MID_X, y: HORIZONTAL_LENGTH }
			};

			const intersection = findLineIntersection(first, second);

			expectPointClose(intersection, { x: MID_X, y: 0 });
		});
	});

	describe('異常系', () => {
		it('平行な直線は交点なしになる', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(0, HORIZONTAL_LENGTH, SHORT_SIDE);

			expect(findLineIntersection(first, second)).toBeNull();
		});
	});

	describe('境界条件', () => {
		it('線分上の位置 0 と 1 は、始点と終点に一致する', () => {
			const segment = horizontal(MID_X, HORIZONTAL_LENGTH, SHORT_SIDE);

			expectPointClose(pointAt(segment, 0), segment.start);
			expectPointClose(pointAt(segment, 1), segment.end);
		});
	});
});

describe('共線の判定', () => {
	describe('正常系', () => {
		it('同一直線上で重なる2線分は共線とみなす', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(OVERLAP_START, OVERLAP_END, 0);

			expect(areSegmentsCollinear(first, second, DEFAULT_EPSILON)).toBe(true);
		});

		it('交差する2線分は共線とみなさない', () => {
			const first: Segment = { start: { x: 0, y: 0 }, end: { x: DIAGONAL_END, y: DIAGONAL_END } };
			const second: Segment = { start: { x: 0, y: DIAGONAL_END }, end: { x: DIAGONAL_END, y: 0 } };

			expect(areSegmentsCollinear(first, second, DEFAULT_EPSILON)).toBe(false);
		});
	});

	describe('異常系', () => {
		it('平行でも離れた2線分は共線とみなさない', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(0, HORIZONTAL_LENGTH, SHORT_SIDE);

			expect(areSegmentsCollinear(first, second, DEFAULT_EPSILON)).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('一方の両端点が直線から ε ちょうどの距離なら共線とみなす', () => {
			const first = horizontal(0, HORIZONTAL_LENGTH, 0);
			const second = horizontal(OVERLAP_START, OVERLAP_END, DEFAULT_EPSILON);

			expect(areSegmentsCollinear(first, second, DEFAULT_EPSILON)).toBe(true);
		});

		it('短い線分の両端点が長い線分の直線に近ければ、逆向きの判定でも共線とみなす', () => {
			const longSegment = horizontal(0, OVERLAP_END * 2, 0);
			const shortSegment = horizontal(OVERLAP_START, HORIZONTAL_LENGTH, DEFAULT_EPSILON);

			expect(areSegmentsCollinear(shortSegment, longSegment, DEFAULT_EPSILON)).toBe(true);
		});
	});
});
