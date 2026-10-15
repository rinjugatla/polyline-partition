import { describe, expect, it } from 'vitest';
import { buildHalfEdges, removeDeadEnds } from './halfEdge';
import type { MergedGraph } from './vertexMerge';

/** 正方形の辺の長さ */
const SIDE = 10;
/** 正方形の頂点数 */
const SQUARE_VERTEX_COUNT = 4;
/** 正方形の辺数 */
const SQUARE_EDGE_COUNT = 4;
/** 枝の途中の倍率 */
const TAIL_MIDDLE_STEP = 3;
/** 枝の先端の倍率 */
const TAIL_LAST_STEP = 4;
/** 鎖の頂点数 */
const CHAIN_VERTEX_COUNT = 3;
/** 枝の先端の x 座標の、正方形の辺の長さに対する倍率 */
const TAIL_STEPS: readonly number[] = [2, TAIL_MIDDLE_STEP, TAIL_LAST_STEP];
/** 辺1本あたりの半辺の数 */
const HALF_EDGES_PER_EDGE = 2;

/** 反時計回りの正方形（頂点 0〜3） */
const SQUARE: MergedGraph = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: SIDE, y: 0 },
		{ x: SIDE, y: SIDE },
		{ x: 0, y: SIDE }
	],
	edges: [
		{ from: 0, to: 1 },
		{ from: 1, to: 2 },
		{ from: 2, to: 3 },
		{ from: 0, to: 3 }
	]
};

describe('行き止まりの除去', () => {
	describe('正常系', () => {
		it('行き止まりのない閉路はそのまま残る', () => {
			const result = removeDeadEnds(SQUARE);

			expect(result.vertices).toHaveLength(SQUARE_VERTEX_COUNT);
			expect(result.edges).toHaveLength(SQUARE_EDGE_COUNT);
		});

		it('閉路に付いた枝を取り除き、頂点 ID を振り直す', () => {
			const withBranch: MergedGraph = {
				vertices: [...SQUARE.vertices, { x: SIDE * 2, y: 0 }],
				edges: [...SQUARE.edges, { from: 1, to: SQUARE_VERTEX_COUNT }]
			};

			const result = removeDeadEnds(withBranch);

			expect(result.vertices).toEqual(SQUARE.vertices);
			expect(result.edges).toEqual(SQUARE.edges);
		});
	});

	describe('異常系', () => {
		it('辺がなければ空のグラフになる', () => {
			expect(removeDeadEnds({ vertices: [], edges: [] })).toEqual({ vertices: [], edges: [] });
		});

		it('閉路のない鎖はすべて取り除かれる', () => {
			const chain: MergedGraph = {
				vertices: SQUARE.vertices.slice(0, CHAIN_VERTEX_COUNT),
				edges: [
					{ from: 0, to: 1 },
					{ from: 1, to: 2 }
				]
			};

			expect(removeDeadEnds(chain)).toEqual({ vertices: [], edges: [] });
		});
	});

	describe('境界条件', () => {
		it('長い枝は端から連鎖的に取り除かれる', () => {
			const tail = TAIL_STEPS.map((step) => ({ x: SIDE * step, y: 0 }));
			const longBranch: MergedGraph = {
				vertices: [...SQUARE.vertices, ...tail],
				edges: [
					...SQUARE.edges,
					{ from: 1, to: SQUARE_VERTEX_COUNT },
					{ from: SQUARE_VERTEX_COUNT, to: SQUARE_VERTEX_COUNT + 1 },
					{ from: SQUARE_VERTEX_COUNT + 1, to: SQUARE_VERTEX_COUNT + 2 }
				]
			};

			expect(removeDeadEnds(longBranch).edges).toEqual(SQUARE.edges);
		});
	});
});

describe('半辺構造の構築', () => {
	describe('正常系', () => {
		it('辺1本につき半辺が2本できる', () => {
			const { halfEdges } = buildHalfEdges(SQUARE);

			expect(halfEdges).toHaveLength(SQUARE_EDGE_COUNT * HALF_EDGES_PER_EDGE);
		});

		it('twin は互いを指し、出発点が逆になる', () => {
			const { halfEdges } = buildHalfEdges(SQUARE);

			for (const [index, halfEdge] of halfEdges.entries()) {
				expect(halfEdges[halfEdge.twin].twin).toBe(index);
				expect(halfEdges[halfEdge.twin].origin).not.toBe(halfEdge.origin);
			}
		});

		it('正方形の内側の半辺は4本で閉路になる', () => {
			const { halfEdges } = buildHalfEdges(SQUARE);

			// 半辺 0 は頂点 0 → 1。面が左側（正方形の内側）に来る
			const cycle = [0];
			for (let current = halfEdges[0].next; current !== 0; current = halfEdges[current].next) {
				cycle.push(current);
			}

			expect(cycle.map((halfEdge) => halfEdges[halfEdge].origin)).toEqual([
				0,
				1,
				2,
				SQUARE_VERTEX_COUNT - 1
			]);
		});
	});

	describe('異常系', () => {
		it('辺がなければ半辺もできない', () => {
			expect(buildHalfEdges({ vertices: [], edges: [] }).halfEdges).toEqual([]);
		});
	});

	describe('境界条件', () => {
		it('多数の辺が集まる頂点でも、next はすべて異なる半辺を指す', () => {
			// 中心 4 から正方形の4頂点へ放射状に伸びる辺を足す
			const center = { x: SIDE / 2, y: SIDE / 2 };
			const star: MergedGraph = {
				vertices: [...SQUARE.vertices, center],
				edges: [
					...SQUARE.edges,
					...SQUARE.vertices.map((_, index) => ({ from: index, to: SQUARE_VERTEX_COUNT }))
				]
			};

			const { halfEdges } = buildHalfEdges(star);

			expect(new Set(halfEdges.map((halfEdge) => halfEdge.next)).size).toBe(halfEdges.length);
		});
	});
});
