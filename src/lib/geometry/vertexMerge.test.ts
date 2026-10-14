import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON } from '../constants';
import { mergeVertices } from './vertexMerge';
import type { Segment } from './types';

/** 2進数で正確に表せ、座標の加減算で誤差が出ない ε（ちょうど ε の境界条件用） */
const EXACT_EPSILON = 0.5;
/** ε の半分 */
const HALF_EPSILON = 0.25;
/** ε をわずかに超える距離 */
const BEYOND_EPSILON = 0.75;
/** ε の2倍の距離（連鎖の端どうしが離れる） */
const DOUBLE_EPSILON = 1;
/** セル境界（ε の整数倍の 0.5）の手前にある点の座標 */
const BEFORE_BOUNDARY = 0.375;
/** セル境界の向こうにある点の座標 */
const AFTER_BOUNDARY = 0.625;
/** 離れた線分の座標 */
const FAR = 10;
/** 三角形の頂点の数 */
const TRIANGLE_VERTEX_COUNT = 3;
/** 併合の結果、頂点が3個になる数 */
const MERGED_VERTEX_COUNT = 3;

/**
 * 線分を生成
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

describe('頂点の併合', () => {
	describe('正常系', () => {
		it('離れた2本の線分は、頂点4個と辺2本になる', () => {
			const graph = mergeVertices([seg(0, 0, 1, 0), seg(FAR, FAR, FAR + 1, FAR)], DEFAULT_EPSILON);

			expect(graph.vertices).toHaveLength(2 + 2);
			expect(graph.edges).toHaveLength(2);
		});

		it('距離が ε 以内の2点を1つの頂点にまとめる', () => {
			const first = seg(0, 0, 1, 0);
			const second = seg(1 + HALF_EPSILON, 0, FAR, 0);

			const graph = mergeVertices([first, second], EXACT_EPSILON);

			expect(graph.vertices).toHaveLength(MERGED_VERTEX_COUNT);
			expect(graph.edges).toEqual([
				{ from: 0, to: 1 },
				{ from: 1, to: 2 }
			]);
		});

		it('代表点はクラスタ内で最初に登録された点になる', () => {
			const first = seg(0, 0, 1, 0);
			const second = seg(1 + HALF_EPSILON, 0, FAR, 0);

			const graph = mergeVertices([first, second], EXACT_EPSILON);

			expect(graph.vertices[1]).toEqual({ x: 1, y: 0 });
		});

		it('三角形を作る3本の線分は、頂点3個と辺3本になる', () => {
			const graph = mergeVertices(
				[seg(0, 0, FAR, 0), seg(FAR, 0, 0, FAR), seg(0, FAR, 0, 0)],
				DEFAULT_EPSILON
			);

			expect(graph.vertices).toHaveLength(TRIANGLE_VERTEX_COUNT);
			expect(graph.edges).toHaveLength(TRIANGLE_VERTEX_COUNT);
		});
	});

	describe('異常系', () => {
		it('入力が空なら頂点も辺もない', () => {
			expect(mergeVertices([], DEFAULT_EPSILON)).toEqual({ vertices: [], edges: [] });
		});

		it('併合で両端が同じ頂点になった線分は捨てる', () => {
			const graph = mergeVertices([seg(0, 0, HALF_EPSILON, 0)], EXACT_EPSILON);

			expect(graph.edges).toEqual([]);
		});

		it('辺に使われない頂点は残さない', () => {
			const graph = mergeVertices(
				[seg(0, 0, HALF_EPSILON, 0), seg(FAR, 0, FAR, FAR)],
				EXACT_EPSILON
			);

			expect(graph.vertices).toEqual([
				{ x: FAR, y: 0 },
				{ x: FAR, y: FAR }
			]);
			expect(graph.edges).toEqual([{ from: 0, to: 1 }]);
		});

		it('同じ辺が重複して入ると1本にまとめる', () => {
			const line = seg(0, 0, FAR, 0);

			const graph = mergeVertices([line, line], DEFAULT_EPSILON);

			expect(graph.edges).toEqual([{ from: 0, to: 1 }]);
		});

		it('向きが逆の同じ辺も1本にまとめる', () => {
			const graph = mergeVertices([seg(0, 0, FAR, 0), seg(FAR, 0, 0, 0)], DEFAULT_EPSILON);

			expect(graph.edges).toEqual([{ from: 0, to: 1 }]);
		});
	});

	describe('境界条件', () => {
		it('距離がちょうど ε の2点は1つの頂点にまとめる', () => {
			const graph = mergeVertices(
				[seg(0, 0, EXACT_EPSILON, 0), seg(FAR, 0, FAR, FAR)],
				EXACT_EPSILON
			);

			expect(graph.vertices).toHaveLength(2);
		});

		it('距離が ε をわずかに超える2点はまとめない', () => {
			const graph = mergeVertices([seg(0, 0, BEYOND_EPSILON, 0)], EXACT_EPSILON);

			expect(graph.vertices).toHaveLength(2);
			expect(graph.edges).toHaveLength(1);
		});

		it('A-B と B-C が ε 以内で A-C が ε を超える連鎖は、3点とも1つにまとめる', () => {
			const chain = [
				seg(0, 0, 0, FAR),
				seg(EXACT_EPSILON, 0, EXACT_EPSILON, FAR),
				seg(DOUBLE_EPSILON, 0, DOUBLE_EPSILON, FAR)
			];

			const graph = mergeVertices(chain, EXACT_EPSILON);

			// 下側の3点と上側の3点がそれぞれ連鎖で1つにまとまり、3本の線分は1本の辺になる
			expect(graph.vertices).toHaveLength(2);
			expect(graph.vertices[0]).toEqual({ x: 0, y: 0 });
			expect(graph.edges).toHaveLength(1);
		});

		it('グリッドのセル境界をまたぐ ε 以内の2点も1つにまとめる', () => {
			const graph = mergeVertices(
				[seg(-FAR, 0, BEFORE_BOUNDARY, 0), seg(AFTER_BOUNDARY, 0, FAR, 0)],
				EXACT_EPSILON
			);

			expect(graph.vertices).toHaveLength(MERGED_VERTEX_COUNT);
		});

		it('セル境界を斜めにまたぐ ε 以内の2点も1つにまとめる', () => {
			const graph = mergeVertices(
				[
					seg(-FAR, -FAR, BEFORE_BOUNDARY, BEFORE_BOUNDARY),
					seg(AFTER_BOUNDARY, AFTER_BOUNDARY, FAR, FAR)
				],
				EXACT_EPSILON
			);

			expect(graph.vertices).toHaveLength(MERGED_VERTEX_COUNT);
		});

		it('併合の結果、異なる2本の線分が同じ頂点の組になるときは辺を1本にまとめる', () => {
			const graph = mergeVertices(
				[seg(0, 0, FAR, 0), seg(HALF_EPSILON, 0, FAR, HALF_EPSILON)],
				EXACT_EPSILON
			);

			expect(graph.vertices).toHaveLength(2);
			expect(graph.edges).toEqual([{ from: 0, to: 1 }]);
		});

		it('負の座標のセル境界をまたぐ2点も1つにまとめる', () => {
			const graph = mergeVertices(
				[seg(-FAR, 0, -BEFORE_BOUNDARY, 0), seg(-AFTER_BOUNDARY, 0, 0, FAR)],
				EXACT_EPSILON
			);

			expect(graph.vertices).toHaveLength(MERGED_VERTEX_COUNT);
		});
	});
});
