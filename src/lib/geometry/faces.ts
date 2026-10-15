import { signedArea } from './primitives';
import type { HalfEdgeStructure } from './halfEdge';
import type { Point } from './types';

/** 面（半辺をたどって得た閉路） */
export type Face = {
	/** 反時計回りにたどった頂点の座標 */
	readonly polygon: readonly Point[];
	/** 面積 */
	readonly area: number;
};

/** 面の列挙結果 */
export type FaceEnumeration = {
	/** 内部の面（微小面を除く） */
	readonly faces: readonly Face[];
	/** 破棄した微小面の数 */
	readonly discardedFaceCount: number;
	/** 微小面を含む内部の面の数（オイラーの検算用） */
	readonly interiorFaceCount: number;
	/** 微小面の面積の総和（面積の検算用） */
	readonly discardedArea: number;
};

/**
 * 半辺をたどって面を列挙
 *
 * 未訪問の半辺から next をたどって閉路を作り、靴ひも公式で符号付き面積を求める。
 * 時計回り（面積が負）の閉路は基礎矩形の外周を外側からたどったもので、グラフは連結なので
 * 1つだけ現れる。これは除く。面積が ε² 未満の面は数値誤差による偽の面として破棄し、数を記録する。
 *
 * @param structure 半辺構造
 * @param epsilon 同値判定の許容誤差 ε
 * @returns 内部の面と、破棄した微小面の情報
 */
export function enumerateFaces(structure: HalfEdgeStructure, epsilon: number): FaceEnumeration {
	const { vertices, halfEdges } = structure;
	const minArea = epsilon * epsilon;
	const visited = new Array<boolean>(halfEdges.length).fill(false);

	const faces: Face[] = [];
	let discardedFaceCount = 0;
	let discardedArea = 0;

	for (const start of halfEdges.keys()) {
		if (visited[start]) continue;

		const polygon: Point[] = [];
		let current = start;
		while (!visited[current]) {
			visited[current] = true;
			polygon.push(vertices[halfEdges[current].origin]);
			current = halfEdges[current].next;
		}

		const area = signedArea(polygon);
		if (area < 0) continue;
		if (area < minArea) {
			discardedFaceCount += 1;
			discardedArea += area;
			continue;
		}
		faces.push({ polygon, area });
	}
	return {
		faces,
		discardedFaceCount,
		interiorFaceCount: faces.length + discardedFaceCount,
		discardedArea
	};
}
