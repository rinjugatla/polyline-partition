import {
	areSegmentsCollinear,
	distanceToRect,
	findLineIntersection,
	isPointNearSegment,
	isSamePoint,
	pointAt,
	toSegments
} from './primitives';
import type { Point, Polyline, RectSize, Segment } from './types';

/** ノーディングの結果 */
export type NodingResult = {
	/** 交点などで分けた小線分。入力の線分の順に、各線分を始点から終点へ並べる */
	readonly segments: readonly Segment[];
	/** 各小線分が由来する入力の線分の添字（`segments` と同じ並び。弦の数え上げでポリラインごとにまとめるのに使う） */
	readonly sourceIndices: readonly number[];
	/** 共線で正の長さにわたって重なる組があったか（弦・交点の検算を省く判断に使う） */
	readonly hasCollinearOverlap: boolean;
};

/** 2線分の組から求めた、それぞれの線分の分割点 */
type PairSplit = {
	/** 1つ目の線分を分ける点 */
	readonly forFirst: readonly Point[];
	/** 2つ目の線分を分ける点 */
	readonly forSecond: readonly Point[];
	/** 共線で正の長さにわたって重なるか */
	readonly hasOverlap: boolean;
};

/**
 * 基礎矩形の4辺
 *
 * 反時計回りに閉じた周になるよう、下辺、右辺、上辺、左辺の順に並べる。
 *
 * @param rect 基礎矩形の大きさ
 * @returns 4辺の線分
 */
function rectSides(rect: RectSize): Segment[] {
	const bottomLeft = { x: 0, y: 0 };
	const bottomRight = { x: rect.width, y: 0 };
	const topRight = { x: rect.width, y: rect.height };
	const topLeft = { x: 0, y: rect.height };
	return toSegments([bottomLeft, bottomRight, topRight, topLeft, bottomLeft]);
}

/**
 * ノーディングの入力になる線分を収集
 *
 * @param polylines すべてのポリライン
 * @param rect 基礎矩形の大きさ
 * @returns ポリラインの線分に、基礎矩形の4辺を加えた線分の列
 */
export function collectSegments(polylines: readonly Polyline[], rect: RectSize): Segment[] {
	return [...polylines.flatMap((polyline) => toSegments(polyline.vertices)), ...rectSides(rect)];
}

/**
 * ε を超えて離れた点の個数
 *
 * @param points 数える点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 同じとみなせる点をまとめたときの点の数
 */
function countDistinctPoints(points: readonly Point[], epsilon: number): number {
	const distinct: Point[] = [];
	for (const point of points) {
		if (!distinct.some((known) => isSamePoint(known, point, epsilon))) distinct.push(point);
	}
	return distinct.length;
}

/**
 * 2線分の組から、それぞれの線分の分割点を算出
 *
 * 分割点は次の3種類である（仕様書 第7章）。
 * - 一方の端点が他方の線分から ε 以内にある場合の、その端点
 * - 共線で重なる場合の、重なり区間の両端点（上の端点と同じ点になる）
 * - 共線でなければ、直線どうしの交点が両方の線分から ε 以内にある場合の、その交点
 *
 * @param first 1つ目の線分
 * @param second 2つ目の線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 各線分の分割点と、共線の重なりの有無
 */
function splitPair(first: Segment, second: Segment, epsilon: number): PairSplit {
	const secondEnds = [second.start, second.end].filter((end) =>
		isPointNearSegment(end, first, epsilon)
	);
	const firstEnds = [first.start, first.end].filter((end) =>
		isPointNearSegment(end, second, epsilon)
	);

	if (areSegmentsCollinear(first, second, epsilon)) {
		// 端点が1点で接するだけなら重なりではない。異なる2点以上が互いの線分上にあれば重なる
		const hasOverlap = countDistinctPoints([...secondEnds, ...firstEnds], epsilon) >= 2;
		return { forFirst: secondEnds, forSecond: firstEnds, hasOverlap };
	}

	const crossing = findLineIntersection(first, second);
	const hasCrossing =
		crossing !== null &&
		isPointNearSegment(crossing, first, epsilon) &&
		isPointNearSegment(crossing, second, epsilon);
	// 端点の分割点を先に並べ、同じ位置の交点が後から重複扱いで除かれるようにする。
	// 端点と交点が ε 以内でずれる場合は頂点が最大 ε ずれるが、頂点の併合（手順4）で吸収する
	return {
		forFirst: hasCrossing ? [...secondEnds, crossing] : secondEnds,
		forSecond: hasCrossing ? [...firstEnds, crossing] : firstEnds,
		hasOverlap: false
	};
}

/**
 * 点が線分上のどの位置にあるか
 *
 * 射影した位置を [0, 1] に収める。ε 以内で線分の外へはみ出した点は端に丸める。
 * 線分の長さが 0 でないことを前提にする（0 除算を避けるため）。
 *
 * @param point 対象の点
 * @param segment 対象の線分
 * @returns 位置（0 が始点、1 が終点）
 */
function ratioAlong(point: Point, segment: Segment): number {
	const dx = segment.end.x - segment.start.x;
	const dy = segment.end.y - segment.start.y;
	const ratio =
		((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / (dx * dx + dy * dy);
	return Math.min(Math.max(ratio, 0), 1);
}

/**
 * 線分を分割点で小線分に分割
 *
 * 分割点は線分に沿った順に並べる。始点や終点、直前の分割点と ε 以内の点は重複として除く。
 *
 * @param segment 分ける線分
 * @param splitPoints 分割点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 始点から終点へ並んだ小線分
 */
function splitSegment(segment: Segment, splitPoints: readonly Point[], epsilon: number): Segment[] {
	// 比較関数が同じ値を返す点どうしは、元の順序（端点の分割点が先）を保つ
	const sorted = [...splitPoints].sort((a, b) => ratioAlong(a, segment) - ratioAlong(b, segment));

	const chain: Point[] = [segment.start];
	for (const point of sorted) {
		const last = chain[chain.length - 1];
		if (isSamePoint(point, last, epsilon) || isSamePoint(point, segment.end, epsilon)) continue;
		chain.push(point);
	}
	chain.push(segment.end);

	return chain.slice(1).map((end, index) => ({ start: chain[index], end }));
}

/**
 * ノーディング（線分どうしの交点を求め、各線分を交点で小線分に分ける処理）
 *
 * 長さが ε 以下の線分は無視する。全線分のペアを調べるので、計算量は線分数の2乗になる。
 *
 * @param segments 分ける線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 小線分と、共線の重なりの有無
 */
export function nodeSegments(segments: readonly Segment[], epsilon: number): NodingResult {
	const sourceOfValid = [...segments.keys()].filter(
		(index) => !isSamePoint(segments[index].start, segments[index].end, epsilon)
	);
	const valid = sourceOfValid.map((index) => segments[index]);
	const splitPoints: Point[][] = valid.map(() => []);
	let hasCollinearOverlap = false;

	for (const [i, first] of valid.entries()) {
		for (const [offset, second] of valid.slice(i + 1).entries()) {
			const j = i + 1 + offset;
			const pair = splitPair(first, second, epsilon);
			splitPoints[i].push(...pair.forFirst);
			splitPoints[j].push(...pair.forSecond);
			hasCollinearOverlap ||= pair.hasOverlap;
		}
	}

	const pieces = valid.map((segment, index) => splitSegment(segment, splitPoints[index], epsilon));
	return {
		segments: pieces.flat(),
		sourceIndices: pieces.flatMap((list, index) => list.map(() => sourceOfValid[index])),
		hasCollinearOverlap
	};
}

/**
 * 基礎矩形の外側にある小線分を除去
 *
 * 小線分の中点が矩形（境界を含む）から ε を超えて外にあるものを捨てる。
 * ノーディング後の小線分は交点で分かれているので、中点で内外を代表できる。
 *
 * @param segments 小線分
 * @param rect 基礎矩形の大きさ
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 矩形の内部と境界上に残る小線分
 */
export function removeOutsideSegments(
	segments: readonly Segment[],
	rect: RectSize,
	epsilon: number
): Segment[] {
	return segments.filter((segment) => distanceToRect(pointAt(segment, 1 / 2), rect) <= epsilon);
}
