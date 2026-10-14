import { isSamePoint } from './primitives';
import type { Point, Segment } from './types';

/**
 * 2つの頂点を結ぶ辺
 *
 * 頂点は ID（`MergedGraph.vertices` の添字）で指す。
 */
export type Edge = {
	/** 小さいほうの頂点 ID */
	readonly from: number;
	/** 大きいほうの頂点 ID */
	readonly to: number;
};

/** 頂点の併合と辺の確定を終えた平面グラフ */
export type MergedGraph = {
	/** 頂点の座標。添字が頂点 ID */
	readonly vertices: readonly Point[];
	/** 重複のない辺 */
	readonly edges: readonly Edge[];
};

/** 格子のセル番号 */
type GridCell = {
	/** セルの x 番号 */
	readonly x: number;
	/** セルの y 番号 */
	readonly y: number;
};

/** 近傍9セルを調べるときの、セル番号の差 */
const NEIGHBOR_OFFSETS: readonly number[] = [-1, 0, 1];

/**
 * 格子のセルを表すキー
 *
 * @param cellX セルの x 番号
 * @param cellY セルの y 番号
 * @returns マップの添字に使う文字列
 */
function cellKey(cellX: number, cellY: number): string {
	return `${cellX},${cellY}`;
}

/**
 * グループの根を探索
 *
 * 経路の途中の要素は、根に直接つなぎ替えて以降の探索を速くする。
 *
 * @param parents 各要素の親。根は自分自身を指す
 * @param index 探す要素
 * @returns 根の添字
 */
function findRoot(parents: number[], index: number): number {
	let root = index;
	while (parents[root] !== root) root = parents[root];

	let current = index;
	while (parents[current] !== root) {
		const next = parents[current];
		parents[current] = root;
		current = next;
	}
	return root;
}

/**
 * 2つの要素のグループを併合
 *
 * 小さい添字の根を残す。添字は登録順なので、根はグループで最初に登録された要素になる。
 *
 * @param parents 各要素の親。根は自分自身を指す
 * @param a 1つ目の要素
 * @param b 2つ目の要素
 */
function union(parents: number[], a: number, b: number): void {
	const rootA = findRoot(parents, a);
	const rootB = findRoot(parents, b);
	if (rootA === rootB) return;
	parents[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
}

/**
 * 近傍9セルに登録済みの点の添字
 *
 * @param cells セルのキーから、登録済みの点の添字への対応
 * @param cell 中心のセル（x と y の番号）
 * @returns 中心のセルと、その周囲8セルにある点の添字
 */
function indicesAround(cells: ReadonlyMap<string, readonly number[]>, cell: GridCell): number[] {
	return NEIGHBOR_OFFSETS.flatMap((dx) =>
		NEIGHBOR_OFFSETS.flatMap((dy) => cells.get(cellKey(cell.x + dx, cell.y + dy)) ?? [])
	);
}

/**
 * 距離が ε 以内の点を、グリッドハッシュと Union-Find でクラスタ化
 *
 * セル幅を ε にするので、ε 以内の点は同じセルか隣のセルにある。近傍9セルだけを調べればよい。
 * A-B と B-C が ε 以内なら、A-C が ε を超えても3点を1つのグループにする（連鎖）。
 *
 * @param points 登録順に並べた点
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 各点が属するグループの根（グループで最初に登録された点の添字）
 */
function clusterPoints(points: readonly Point[], epsilon: number): number[] {
	const parents = points.map((_, index) => index);
	const cells = new Map<string, number[]>();

	for (const [index, point] of points.entries()) {
		const cell = { x: Math.floor(point.x / epsilon), y: Math.floor(point.y / epsilon) };
		for (const other of indicesAround(cells, cell)) {
			if (isSamePoint(points[other], point, epsilon)) union(parents, other, index);
		}
		const key = cellKey(cell.x, cell.y);
		const members = cells.get(key);
		if (members === undefined) cells.set(key, [index]);
		else members.push(index);
	}
	return parents.map((_, index) => findRoot(parents, index));
}

/**
 * 頂点の併合と辺の確定
 *
 * 小線分の端点のうち距離が ε 以内のものを1つの頂点にまとめ、代表点はグループで最初に登録された点とする。
 * 両端が同じ頂点になった線分は捨て、同じ頂点の組を結ぶ辺は1本にまとめる（向きは区別しない）。
 * 以降は頂点を ID で扱い、座標の比較はしない。辺に使われない頂点は残さず、
 * 頂点 ID は辺に最初に現れた順に振る。ε は正の値（設定の下限以上）を前提とし、0 は渡さない。
 *
 * @param segments ノーディング後の小線分
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 頂点と辺
 */
export function mergeVertices(segments: readonly Segment[], epsilon: number): MergedGraph {
	// 端点を [始点, 終点] の順に登録する。線分 i の端点の添字は 2i と 2i + 1
	const points = segments.flatMap((segment) => [segment.start, segment.end]);
	const roots = clusterPoints(points, epsilon);

	const ids = new Map<number, number>();
	const vertices: Point[] = [];
	const edgeKeys = new Set<string>();
	const edges: Edge[] = [];

	/**
	 * グループの根を、頂点 ID に変換
	 *
	 * @param root グループの根
	 * @returns 頂点 ID。初めて現れたグループには新しい ID を振る
	 */
	const toVertexId = (root: number): number => {
		const known = ids.get(root);
		if (known !== undefined) return known;
		ids.set(root, vertices.length);
		vertices.push(points[root]);
		return vertices.length - 1;
	};

	for (const index of segments.keys()) {
		const rootA = roots[2 * index];
		const rootB = roots[2 * index + 1];
		if (rootA === rootB) continue;

		const [first, second] = [rootA, rootB].sort((a, b) => a - b);
		const key = `${first},${second}`;
		if (edgeKeys.has(key)) continue;
		edgeKeys.add(key);

		const from = toVertexId(first);
		const to = toVertexId(second);
		edges.push({ from: Math.min(from, to), to: Math.max(from, to) });
	}
	return { vertices, edges };
}
