import type { Edge, MergedGraph } from './vertexMerge';
import type { Point } from './types';

/**
 * 半辺
 *
 * 辺を向きの異なる2本に分けたうちの1本。面は常に半辺の左側に来る。
 */
export type HalfEdge = {
	/** 出発する頂点の ID */
	readonly origin: number;
	/** 逆向きの半辺の添字 */
	readonly twin: number;
	/** 同じ面を反時計回りにたどるときの、次の半辺の添字 */
	readonly next: number;
};

/** 半辺構造（半辺で表した平面グラフ） */
export type HalfEdgeStructure = {
	/** 頂点の座標。添字が頂点 ID */
	readonly vertices: readonly Point[];
	/** 半辺。辺 i の from → to が 2i、to → from が 2i + 1 */
	readonly halfEdges: readonly HalfEdge[];
};

/**
 * 行き止まりの頂点と辺を取り除く
 *
 * 次数1の頂点とその辺を、なくなるまで繰り返し取り除く。弦は両端が矩形境界に届くため
 * 理論上は発生しないが、数値誤差への防御として行う。辺に使われなくなった頂点は残さず、
 * 頂点 ID は元の順序を保って振り直す。
 *
 * @param graph 頂点と辺
 * @returns 行き止まりのないグラフ
 */
export function removeDeadEnds(graph: MergedGraph): MergedGraph {
	const incident: Set<number>[] = graph.vertices.map(() => new Set<number>());
	for (const [index, edge] of graph.edges.entries()) {
		incident[edge.from].add(index);
		incident[edge.to].add(index);
	}

	const removed = new Set<number>();
	const pending = [...graph.vertices.keys()].filter((vertex) => incident[vertex].size === 1);
	while (pending.length > 0) {
		const vertex = pending.pop();
		if (vertex === undefined || incident[vertex].size !== 1) continue;

		const [edgeIndex] = incident[vertex];
		removed.add(edgeIndex);
		const edge = graph.edges[edgeIndex];
		for (const end of [edge.from, edge.to]) {
			incident[end].delete(edgeIndex);
			if (incident[end].size === 1) pending.push(end);
		}
	}
	return compactGraph(
		graph.vertices,
		graph.edges.filter((_, index) => !removed.has(index))
	);
}

/**
 * 辺に使われる頂点だけを残し、頂点 ID を振り直す
 *
 * @param vertices 元の頂点
 * @param edges 残す辺
 * @returns 頂点と辺
 */
function compactGraph(vertices: readonly Point[], edges: readonly Edge[]): MergedGraph {
	const used = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
	const newIds = new Map<number, number>();
	const compacted: Point[] = [];
	for (const [id, point] of vertices.entries()) {
		if (!used.has(id)) continue;
		newIds.set(id, compacted.length);
		compacted.push(point);
	}
	return {
		vertices: compacted,
		edges: edges.map((edge) => ({
			// 使われる頂点は必ず登録済みなので、undefined にならない
			from: newIds.get(edge.from) ?? edge.from,
			to: newIds.get(edge.to) ?? edge.to
		}))
	};
}

/**
 * 半辺の向きの角度
 *
 * @param vertices 頂点の座標
 * @param origin 出発する頂点の ID
 * @param target 向かう頂点の ID
 * @returns `atan2` の角度（反時計回りが正）
 */
function directionAngle(vertices: readonly Point[], origin: number, target: number): number {
	return Math.atan2(
		vertices[target].y - vertices[origin].y,
		vertices[target].x - vertices[origin].x
	);
}

/**
 * 半辺構造を構築
 *
 * 各辺を向きの異なる2本の半辺にして twin を結ぶ。各頂点から出る半辺を反時計回りの順に並べ、
 * 半辺 h（u → v）の next は、頂点 v で twin(h)（v → u）の1つ手前、つまり時計回り側で
 * 隣の出半辺とする。この規則だと、面が常に半辺の左側に来る。
 *
 * @param graph 行き止まりのないグラフ
 * @returns 半辺構造
 */
export function buildHalfEdges(graph: MergedGraph): HalfEdgeStructure {
	const { vertices, edges } = graph;
	const origins = edges.flatMap((edge) => [edge.from, edge.to]);
	const targets = edges.flatMap((edge) => [edge.to, edge.from]);

	// 頂点ごとに出る半辺を集め、角度の昇順（反時計回り）に並べる
	const outgoing: number[][] = vertices.map(() => []);
	for (const [halfEdge, origin] of origins.entries()) outgoing[origin].push(halfEdge);
	const angles = origins.map((origin, halfEdge) =>
		directionAngle(vertices, origin, targets[halfEdge])
	);
	for (const list of outgoing) list.sort((a, b) => angles[a] - angles[b]);

	// 出半辺の並びの中での位置。next の計算で twin の1つ手前を引くのに使う
	const positions = new Map<number, number>();
	for (const list of outgoing) {
		for (const [position, halfEdge] of list.entries()) positions.set(halfEdge, position);
	}

	const halfEdges = origins.map((origin, halfEdge): HalfEdge => {
		const twin = halfEdge ^ 1;
		const around = outgoing[targets[halfEdge]];
		// twin の位置は必ず登録済み。先頭の1つ手前は末尾に戻る
		const position = positions.get(twin) ?? 0;
		const next = around[(position - 1 + around.length) % around.length];
		return { origin, twin, next };
	});
	return { vertices, halfEdges };
}
