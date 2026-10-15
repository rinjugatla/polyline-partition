import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import { enumerateFaces } from './faces';
import { buildHalfEdges } from './halfEdge';
import type { MergedGraph } from './vertexMerge';

/** 正方形の辺の長さ */
const SIDE = 10;
/** 格子の1マスの辺の長さ */
const CELL = 5;
/** 格子の1辺あたりの頂点数 */
const GRID_SIZE = 3;
/** 格子のマスの数 */
const GRID_CELL_COUNT = 4;
/** 微小面の1辺の長さ（面積が ε² を下回る） */
const TINY_SIDE = 0.001;
/** 微小面を持つグラフの内部の面の数 */
const TINY_GRAPH_FACE_COUNT = 2;
/** 正方形の頂点数 */
const SQUARE_VERTEX_COUNT = 4;

/**
 * 辺の長さ side の正方形のグラフを生成
 *
 * @param side 辺の長さ
 * @returns 反時計回りの正方形
 */
function square(side: number): MergedGraph {
	return {
		vertices: [
			{ x: 0, y: 0 },
			{ x: side, y: 0 },
			{ x: side, y: side },
			{ x: 0, y: side }
		],
		edges: [
			{ from: 0, to: 1 },
			{ from: 1, to: 2 },
			{ from: 2, to: 3 },
			{ from: 0, to: 3 }
		]
	};
}

/**
 * 3 × 3 頂点の格子グラフを生成
 *
 * @returns 4マスの格子
 */
function grid(): MergedGraph {
	const vertices = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
		x: (index % GRID_SIZE) * CELL,
		y: Math.floor(index / GRID_SIZE) * CELL
	}));
	const edges = vertices.flatMap((_, index) => {
		const column = index % GRID_SIZE;
		const row = Math.floor(index / GRID_SIZE);
		return [
			...(column < GRID_SIZE - 1 ? [{ from: index, to: index + 1 }] : []),
			...(row < GRID_SIZE - 1 ? [{ from: index, to: index + GRID_SIZE }] : [])
		];
	});
	return { vertices, edges };
}

describe('面の列挙', () => {
	describe('正常系', () => {
		it('正方形は内部1面と外周1面になり、内部の面だけを返す', () => {
			const result = enumerateFaces(buildHalfEdges(square(SIDE)), DEFAULT_EPSILON);

			expect(result.faces).toHaveLength(1);
			expect(result.faces[0].area).toBe(SIDE * SIDE);
		});

		it('格子は、マスの数だけの面を返す', () => {
			const result = enumerateFaces(buildHalfEdges(grid()), DEFAULT_EPSILON);

			expect(result.faces).toHaveLength(GRID_CELL_COUNT);
			expect(result.faces.every((face) => face.area === CELL * CELL)).toBe(true);
		});

		it('面の頂点は反時計回りで、面積が正になる', () => {
			const result = enumerateFaces(buildHalfEdges(square(SIDE)), DEFAULT_EPSILON);

			expect(result.faces[0].polygon).toHaveLength(SQUARE_VERTEX_COUNT);
			expect(result.faces[0].area).toBeGreaterThan(0);
		});
	});

	describe('異常系', () => {
		it('半辺がなければ面もない', () => {
			const result = enumerateFaces({ vertices: [], halfEdges: [] }, DEFAULT_EPSILON);

			expect(result).toEqual({
				faces: [],
				discardedFaceCount: 0,
				interiorFaceCount: 0,
				discardedArea: 0
			});
		});
	});

	describe('境界条件', () => {
		it('面積が ε² 未満の面は破棄し、数を記録する', () => {
			// 大きな正方形の中に、微小な正方形を辺でつないで置く代わりに、微小な正方形だけを渡す
			const result = enumerateFaces(buildHalfEdges(square(TINY_SIDE)), DEFAULT_EPSILON);

			expect(result.faces).toHaveLength(0);
			expect(result.discardedFaceCount).toBe(1);
			expect(result.discardedArea).toBeCloseTo(TINY_SIDE * TINY_SIDE);
		});

		it('微小面を含む内部の面数を記録する', () => {
			const big = square(SIDE);
			const tinyOffset = big.vertices.length;
			const tiny = square(TINY_SIDE);
			// 微小な正方形を大きな正方形の外へ離して置き、辺でつないで連結にする
			const moved = tiny.vertices.map((vertex) => ({ x: vertex.x + SIDE * 2, y: vertex.y }));
			const graph: MergedGraph = {
				vertices: [...big.vertices, ...moved],
				edges: [
					...big.edges,
					...tiny.edges.map((edge) => ({ from: edge.from + tinyOffset, to: edge.to + tinyOffset })),
					{ from: 1, to: tinyOffset }
				]
			};

			const result = enumerateFaces(buildHalfEdges(graph), DEFAULT_EPSILON);

			expect(result.interiorFaceCount).toBe(TINY_GRAPH_FACE_COUNT);
			expect(result.faces).toHaveLength(1);
			expect(result.discardedFaceCount).toBe(1);
		});

		it('多数の辺が1点に集まる頂点でも、面を正しく数える', () => {
			const base = square(SIDE);
			const center = { x: SIDE / 2, y: SIDE / 2 };
			const star: MergedGraph = {
				vertices: [...base.vertices, center],
				edges: [
					...base.edges,
					...base.vertices.map((_, index) => ({ from: index, to: SQUARE_VERTEX_COUNT }))
				]
			};

			const result = enumerateFaces(buildHalfEdges(star), DEFAULT_EPSILON);

			expect(result.faces).toHaveLength(SQUARE_VERTEX_COUNT);
			expect(result.faces.reduce((sum, face) => sum + face.area, 0)).toBeCloseTo(SIDE * SIDE);
		});
	});
});
