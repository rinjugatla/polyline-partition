import { enumerateFaces, type Face } from './faces';
import { buildHalfEdges, removeDeadEnds } from './halfEdge';
import { collectSegments, nodeSegments, removeOutsideSegments, type NodingResult } from './noding';
import { CENTROID_AREA_FACTOR } from '../constants';
import { pointAt, toSegments } from './primitives';
import type { Point, Polyline, RectSize } from './types';
import { validatePolyline, type Violation } from './validate';
import { mergeVertices, type MergedGraph } from './vertexMerge';

/** 分割で得られた区画（色は色付けの段階で決める） */
export type PartitionRegion = {
	/** 重心の y、x の順に並べた番号（0 から） */
	readonly id: number;
	/** 反時計回りにたどった頂点の座標 */
	readonly polygon: readonly Point[];
	/** 面積 */
	readonly area: number;
};

/** 統計と検算の結果（保存しない） */
export type PartitionStats = {
	/** 配置した全ポリラインの数 */
	readonly polylineCount: number;
	/** 区画数（微小面を除く） */
	readonly regionCount: number;
	/** 弦（ポリラインのうち矩形の内部にある連続した区間）の数の合計 */
	readonly chordCount: number;
	/** 矩形の内部で k 本の弦が通る点それぞれの (k − 1) の合計 */
	readonly intersectionCount: number;
	/** 破棄した微小面の数 */
	readonly discardedFaceCount: number;
	/** 検算の結果 */
	readonly checks: {
		/** オイラーの公式が成立するか */
		readonly euler: boolean;
		/** 弦・交点の式が成立するか。共線の重なりがあり検算できないときは null */
		readonly chordFormula: boolean | null;
		/** 区画と微小面の面積の総和が W × H に一致するか */
		readonly areaSum: boolean;
	};
};

/** 分割結果（保存しない） */
export type PartitionResult = {
	/** 区画 */
	readonly regions: readonly PartitionRegion[];
	/** 統計と検算 */
	readonly stats: PartitionStats;
};

/** 分割の入力 */
export type PartitionRequest = {
	/** すべてのポリライン */
	readonly polylines: readonly Polyline[];
	/** 基礎矩形の大きさ */
	readonly rect: RectSize;
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
};

/** 検証に違反したポリライン */
export type InvalidPolyline = {
	/** ポリラインの ID */
	readonly polylineId: string;
	/** 違反の一覧 */
	readonly violations: readonly Violation[];
};

/** 分割に成功した結果 */
export type PartitionSuccess = {
	/** 成功を表す印 */
	readonly ok: true;
	/** 区画と統計 */
	readonly result: PartitionResult;
};

/** 無効なポリラインがあり、実行を拒否した結果 */
export type PartitionRejection = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 違反のあるポリライン */
	readonly invalidPolylines: readonly InvalidPolyline[];
};

/**
 * 分割の結果
 *
 * 無効なポリラインを含む入力は想定内の失敗なので、例外ではなく判別共用体で返す。
 */
export type PartitionOutcome = PartitionSuccess | PartitionRejection;

/**
 * 点が基礎矩形の内部にあるか
 *
 * 境界から距離 ε を超えて内側にある点を内部とする。
 *
 * @param point 対象の点
 * @param rect 基礎矩形の大きさ
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 内部か
 */
function isInsideRect(point: Point, rect: RectSize, epsilon: number): boolean {
	return (
		point.x > epsilon &&
		point.x < rect.width - epsilon &&
		point.y > epsilon &&
		point.y < rect.height - epsilon
	);
}

/**
 * 小線分の添字から、由来するポリラインの添字への対応
 *
 * 入力の線分は、ポリラインの線分を順に並べたあとに矩形の4辺が続く。
 *
 * @param polylines すべてのポリライン
 * @returns 入力の線分の添字ごとのポリラインの添字（矩形の辺は含まない）
 */
function polylineOfSegment(polylines: readonly Polyline[]): number[] {
	return polylines.flatMap((polyline, index) => toSegments(polyline.vertices).map(() => index));
}

/**
 * 弦の数を数える
 *
 * ポリラインに沿って並べた小線分のうち、矩形の内部にある連続した区間を1本の弦とする。
 * 区間の継ぎ目が境界上の点に触れていれば、そこで区切る。
 *
 * @param noding ノーディングの結果
 * @param polylines すべてのポリライン
 * @param rect 基礎矩形の大きさ
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 弦の数の合計
 */
function countChords(
	noding: NodingResult,
	polylines: readonly Polyline[],
	rect: RectSize,
	epsilon: number
): number {
	const owners = polylineOfSegment(polylines);
	let count = 0;
	let isInChord = false;
	let previousOwner = -1;

	for (const [index, segment] of noding.segments.entries()) {
		const owner = owners[noding.sourceIndices[index]];
		// 矩形の辺の小線分は弦ではない。ポリラインが変わったら区間も途切れる
		if (owner === undefined) continue;
		if (owner !== previousOwner) isInChord = false;
		previousOwner = owner;

		if (!isInsideRect(pointAt(segment, 1 / 2), rect, epsilon)) {
			isInChord = false;
			continue;
		}
		// 継ぎ目が境界上の点なら、直前の弦はそこで終わり、新しい弦が始まる
		if (!isInChord || !isInsideRect(segment.start, rect, epsilon)) count += 1;
		isInChord = true;
	}
	return count;
}

/**
 * 交点の数を数える
 *
 * 矩形の内部の頂点に k 本の弦が通るとき、次数は 2k になる（共線の重なりがない場合）。
 * 頂点ごとに (k − 1) を足す。
 *
 * @param graph 行き止まりのないグラフ
 * @param rect 基礎矩形の大きさ
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 交点の数
 */
function countIntersections(graph: MergedGraph, rect: RectSize, epsilon: number): number {
	const degrees = graph.vertices.map(() => 0);
	for (const edge of graph.edges) {
		degrees[edge.from] += 1;
		degrees[edge.to] += 1;
	}
	return graph.vertices.reduce((sum, vertex, id) => {
		if (!isInsideRect(vertex, rect, epsilon)) return sum;
		return sum + Math.max(Math.floor(degrees[id] / 2) - 1, 0);
	}, 0);
}

/**
 * 多角形の重心
 *
 * @param polygon 反時計回りにたどった頂点
 * @param area 多角形の面積（正）
 * @returns 重心
 */
function centroidOf(polygon: readonly Point[], area: number): Point {
	let sumX = 0;
	let sumY = 0;
	for (const [index, current] of polygon.entries()) {
		const next = polygon[(index + 1) % polygon.length];
		const cross = current.x * next.y - next.x * current.y;
		sumX += (current.x + next.x) * cross;
		sumY += (current.y + next.y) * cross;
	}
	const factor = 1 / (CENTROID_AREA_FACTOR * area);
	return { x: sumX * factor, y: sumY * factor };
}

/**
 * 面を重心の y、x の順に並べ、番号を振った区画にする
 *
 * 同じ入力なら同じ並びにするため、y の差が ε 以内なら同じ高さとして x で比べる。
 *
 * @param faces 内部の面
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 番号を振った区画
 */
function toRegions(faces: readonly Face[], epsilon: number): PartitionRegion[] {
	return faces
		.map((face) => ({ face, centroid: centroidOf(face.polygon, face.area) }))
		.sort((a, b) => {
			const dy = a.centroid.y - b.centroid.y;
			return Math.abs(dy) > epsilon ? dy : a.centroid.x - b.centroid.x;
		})
		.map(({ face }, id) => ({ id, polygon: face.polygon, area: face.area }));
}

/**
 * 無効なポリラインを探す
 *
 * @param request 分割の入力
 * @returns 違反のあるポリライン（なければ空）
 */
function findInvalidPolylines(request: PartitionRequest): InvalidPolyline[] {
	const { polylines, rect, epsilon } = request;
	return polylines.flatMap((polyline) => {
		const validation = validatePolyline({ vertices: polyline.vertices, rect, epsilon });
		return validation.ok ? [] : [{ polylineId: polyline.id, violations: validation.violations }];
	});
}

/**
 * 区画に分割
 *
 * ノーディング、矩形外の除去、頂点の併合、行き止まりの除去、半辺構造の構築、面の列挙の順に
 * 処理して、内部の面を区画とする（仕様書 第7章）。無効なポリラインを含む入力は実行を拒否する。
 *
 * @param request 分割の入力
 * @returns 区画と統計。無効なポリラインがあれば違反の一覧
 */
export function partition(request: PartitionRequest): PartitionOutcome {
	const invalidPolylines = findInvalidPolylines(request);
	if (invalidPolylines.length > 0) return { ok: false, invalidPolylines };

	const { polylines, rect, epsilon } = request;
	const noding = nodeSegments(collectSegments(polylines, rect), epsilon);
	const inside = removeOutsideSegments(noding.segments, rect, epsilon);
	const graph = removeDeadEnds(mergeVertices(inside, epsilon));
	const enumeration = enumerateFaces(buildHalfEdges(graph), epsilon);

	const regions = toRegions(enumeration.faces, epsilon);
	const chordCount = countChords(noding, polylines, rect, epsilon);
	const intersectionCount = countIntersections(graph, rect, epsilon);

	const totalArea =
		enumeration.faces.reduce((sum, face) => sum + face.area, 0) + enumeration.discardedArea;
	const areaTolerance = epsilon * 2 * (rect.width + rect.height);

	return {
		ok: true,
		result: {
			regions,
			stats: {
				polylineCount: polylines.length,
				regionCount: regions.length,
				chordCount,
				intersectionCount,
				discardedFaceCount: enumeration.discardedFaceCount,
				checks: {
					// 微小面を含む内部の面数 = E − V + 1（グラフが連結なため常に成立）
					euler: enumeration.interiorFaceCount === graph.edges.length - graph.vertices.length + 1,
					chordFormula: noding.hasCollinearOverlap
						? null
						: regions.length === 1 + chordCount + intersectionCount,
					areaSum: Math.abs(totalArea - rect.width * rect.height) <= areaTolerance
				}
			}
		}
	};
}
