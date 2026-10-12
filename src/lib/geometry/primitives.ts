import { MIN_POLYGON_VERTICES } from '../constants';
import type { Point, RectSize, Segment } from './types';

/**
 * 2点間の距離
 *
 * @param a 1つ目の点
 * @param b 2つ目の点
 * @returns ユークリッド距離
 */
export function distanceBetween(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 2点が同じ点とみなせるか
 *
 * 計算誤差による「ほぼ同じ位置」を同一視するため、座標の `===` 比較の代わりに必ずこれを通す。
 *
 * @param a 1つ目の点
 * @param b 2つ目の点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 距離が ε 以下か
 */
export function isSamePoint(a: Point, b: Point, epsilon: number): boolean {
	return distanceBetween(a, b) <= epsilon;
}

/**
 * 点から基礎矩形（境界を含む閉領域）までの距離
 *
 * 矩形の内部と境界上では 0 になる。辺ごとの超過量 dx、dy から √(dx² + dy²) で求める。
 *
 * @param point 対象の点
 * @param rect 基礎矩形の大きさ
 * @returns 矩形までの距離
 */
export function distanceToRect(point: Point, rect: RectSize): number {
	const dx = Math.max(-point.x, 0, point.x - rect.width);
	const dy = Math.max(-point.y, 0, point.y - rect.height);
	return Math.hypot(dx, dy);
}

/**
 * 点から線分までの距離
 *
 * 垂線の足が線分の外に出る場合は、近いほうの端点までの距離になる。
 * 長さ0の線分は端点との距離を返す。
 *
 * @param point 対象の点
 * @param segment 対象の線分
 * @returns 点と線分の最短距離
 */
export function distancePointToSegment(point: Point, segment: Segment): number {
	const { start, end } = segment;
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const lengthSquared = dx * dx + dy * dy;
	// 0 除算を避けるガード。ε 以下の短い線分の扱いは呼び出し側（V-02）が決める
	if (lengthSquared === 0) return distanceBetween(point, start);

	// 射影の位置を [0, 1] に収め、線分の外へはみ出した分を端点に丸める
	const ratio = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
	const clampedRatio = Math.min(Math.max(ratio, 0), 1);
	return distanceBetween(point, { x: start.x + clampedRatio * dx, y: start.y + clampedRatio * dy });
}

/**
 * 点が線分から ε 以内にあるか
 *
 * 頂点の併合や交点計算で、点が線分上にあるかの判定に使う。
 *
 * @param point 対象の点
 * @param segment 対象の線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 線分までの距離が ε 以下か
 */
export function isPointNearSegment(point: Point, segment: Segment, epsilon: number): boolean {
	return distancePointToSegment(point, segment) <= epsilon;
}

/** 2直線の交点を、各線分上の位置で表したもの */
type LineIntersectionParams = {
	/** 1つ目の線分上の位置（0 が始点、1 が終点） */
	readonly t: number;
	/** 2つ目の線分上の位置（0 が始点、1 が終点） */
	readonly u: number;
};

/**
 * 2本の直線の交点を、各線分上の位置で求める
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @returns 位置の組。平行（外積が 0）なら null
 */
function solveLineIntersection(first: Segment, second: Segment): LineIntersectionParams | null {
	const firstDx = first.end.x - first.start.x;
	const firstDy = first.end.y - first.start.y;
	const secondDx = second.end.x - second.start.x;
	const secondDy = second.end.y - second.start.y;

	const cross = firstDx * secondDy - firstDy * secondDx;
	// 0 除算を避けるガード。ほぼ平行な場合も、呼び出し側の範囲検査を通った解は実際の交点になる
	if (cross === 0) return null;

	// first 上の位置 t と second 上の位置 u を、連立方程式の解として求める
	const gapX = second.start.x - first.start.x;
	const gapY = second.start.y - first.start.y;
	return {
		t: (gapX * secondDy - gapY * secondDx) / cross,
		u: (gapX * firstDy - gapY * firstDx) / cross
	};
}

/**
 * 2線分の交点
 *
 * 非平行な2線分が端点を含めて交わるときだけ交点を返す。
 * 平行な線分と長さ0の線分は、共線で重なる場合も含めて null を返す（重なりの扱いは呼び出し側で行う）。
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @returns 交点。交わらない、または平行なら null
 */
export function findSegmentIntersection(first: Segment, second: Segment): Point | null {
	const params = solveLineIntersection(first, second);
	if (params === null) return null;

	const { t, u } = params;
	if (t < 0 || t > 1 || u < 0 || u > 1) return null;

	return pointAt(first, t);
}

/**
 * 2本の直線の交点
 *
 * 線分の範囲を無視して、延長した直線どうしの交点を返す。
 * ε 以内の端点のずれを許す交点判定で、交点が両方の線分の近くにあるかは呼び出し側が調べる。
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @returns 交点。平行なら null
 */
export function findLineIntersection(first: Segment, second: Segment): Point | null {
	const params = solveLineIntersection(first, second);
	return params === null ? null : pointAt(first, params.t);
}

/**
 * 線分上の位置に対応する点
 *
 * @param segment 対象の線分
 * @param ratio 位置（0 が始点、1 が終点。範囲外なら延長線上）
 * @returns 位置に対応する点
 */
export function pointAt(segment: Segment, ratio: number): Point {
	return {
		x: segment.start.x + ratio * (segment.end.x - segment.start.x),
		y: segment.start.y + ratio * (segment.end.y - segment.start.y)
	};
}

/**
 * 点から、線分を含む直線までの距離
 *
 * 長さ0の線分は端点との距離を返す。
 *
 * @param point 対象の点
 * @param segment 直線を決める線分
 * @returns 点と直線の距離
 */
export function distancePointToLine(point: Point, segment: Segment): number {
	const dx = segment.end.x - segment.start.x;
	const dy = segment.end.y - segment.start.y;
	const length = Math.hypot(dx, dy);
	if (length === 0) return distanceBetween(point, segment.start);

	const cross = dx * (point.y - segment.start.y) - dy * (point.x - segment.start.x);
	return Math.abs(cross) / length;
}

/**
 * 2線分が共線とみなせるか
 *
 * 一方の両端点が、他方を含む直線から ε 以内にあれば共線とする（仕様書 第7章）。
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 共線か
 */
export function areSegmentsCollinear(first: Segment, second: Segment, epsilon: number): boolean {
	const isOnLine = (line: Segment, other: Segment): boolean =>
		distancePointToLine(other.start, line) <= epsilon &&
		distancePointToLine(other.end, line) <= epsilon;
	return isOnLine(first, second) || isOnLine(second, first);
}

/**
 * 2線分の最短距離
 *
 * 交差、接触、共線の重なりはすべて 0 になる。交わらない場合の最短距離は、
 * どちらかの端点が相手の線分に最も近づく位置で決まるため、端点4つの距離の最小値で求める。
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @returns 2線分の最短距離
 */
export function segmentDistance(first: Segment, second: Segment): number {
	if (findSegmentIntersection(first, second) !== null) return 0;

	return Math.min(
		distancePointToSegment(first.start, second),
		distancePointToSegment(first.end, second),
		distancePointToSegment(second.start, first),
		distancePointToSegment(second.end, first)
	);
}

/**
 * 多角形の符号付き面積
 *
 * 靴ひも公式で求める。頂点を反時計回りにたどると正、時計回りだと負になる。
 * 頂点が3個未満のときは面積 0 とする。
 *
 * @param polygon 順にたどる頂点（始点を末尾に繰り返さない）
 * @returns 符号付き面積
 */
export function signedArea(polygon: readonly Point[]): number {
	if (polygon.length < MIN_POLYGON_VERTICES) return 0;

	let doubledArea = 0;
	for (const [index, current] of polygon.entries()) {
		// 末尾の次は先頭に戻して、多角形を閉じる
		const next = polygon[(index + 1) % polygon.length];
		doubledArea += current.x * next.y - next.x * current.y;
	}
	return doubledArea / 2;
}

/**
 * 線分が基礎矩形の内部を通るか
 *
 * 内部は矩形の境界から距離 ε を超えて内側の領域とする。矩形を ε だけ縮めた領域と、
 * 正の長さで重なるかを Liang–Barsky 法のクリップで判定する。
 * 角をかすめるだけの線分や境界線上の線分は、縮めた領域と重ならないため false になる。
 *
 * @param segment 対象の線分
 * @param rect 基礎矩形の大きさ
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 内部を正の長さで通るか
 */
export function passesThroughRectInterior(
	segment: Segment,
	rect: RectSize,
	epsilon: number
): boolean {
	const dx = segment.end.x - segment.start.x;
	const dy = segment.end.y - segment.start.y;
	// 長さ0の線分は通る長さを持たない。0 除算を避けるガードも兼ねる
	if (dx === 0 && dy === 0) return false;

	// 縮めた領域の4辺ごとに、線分上の位置 t の有効範囲を絞り込む
	const limits: readonly (readonly [number, number])[] = [
		[-dx, segment.start.x - epsilon],
		[dx, rect.width - epsilon - segment.start.x],
		[-dy, segment.start.y - epsilon],
		[dy, rect.height - epsilon - segment.start.y]
	];

	let enter = 0;
	let leave = 1;
	for (const [direction, distance] of limits) {
		if (direction === 0) {
			// 辺と平行な線分は、縮めた領域の外側か、その境界線上（距離がちょうど ε）なら内部を通らない
			if (distance <= 0) return false;
			continue;
		}
		const ratio = distance / direction;
		if (direction < 0) enter = Math.max(enter, ratio);
		else leave = Math.min(leave, ratio);
	}
	return enter < leave;
}
