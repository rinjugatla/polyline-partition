import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON, MAX_RECT_SIZE, MIN_RECT_SIZE } from '../constants';
import type { Point } from '../geometry/types';
import { createDocument } from './document';
import {
	checkAddVertex,
	clearPolylines,
	findInvalid,
	finishPolyline,
	moveVertex,
	removePolyline,
	resizeRect,
	type EditResult
} from './documentOps';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の外側の座標 */
const OUTSIDE = -50;
/** 矩形の右外の座標 */
const OUTSIDE_RIGHT = 1050;
/** 矩形を縮めた後の一辺 */
const SMALL_SIDE = 100;
/** 範囲外の一辺 */
const TOO_LARGE = MAX_RECT_SIZE + 1;
/** 2本目のポリラインの ID が採番される番号 */
const SECOND_ID = 'p2';

/** 左右に抜ける水平線の頂点 */
const HORIZONTAL: Point[] = [
	{ x: OUTSIDE, y: MID },
	{ x: OUTSIDE_RIGHT, y: MID }
];

/**
 * 成功を前提に、編集後のドキュメントを取り出す
 *
 * @param result 編集の結果
 * @returns 編集後のドキュメント
 */
function expectOk(result: EditResult): ReturnType<typeof createDocument> {
	if (!result.ok) throw new Error(`編集に失敗した: ${result.messages.join(',')}`);
	return result.document;
}

describe('ドキュメントの編集', () => {
	describe('正常系', () => {
		it('描画を確定すると、ID を振ったポリラインが追加される', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			expect(document.polylines).toHaveLength(1);
			expect(document.polylines[0].id).toBe('p1');
		});

		it('確定時に、末尾の重複頂点を取り除く', () => {
			const draft = [...HORIZONTAL, HORIZONTAL[1]];

			const document = expectOk(finishPolyline(createDocument(), draft, DEFAULT_EPSILON));

			expect(document.polylines[0].vertices).toHaveLength(HORIZONTAL.length);
		});

		it('ポリラインを削除しても、新しい ID は既存と重複しない', () => {
			const first = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));
			const second = expectOk(finishPolyline(first, HORIZONTAL, DEFAULT_EPSILON));
			const removed = removePolyline(second, 'p1');

			const third = expectOk(finishPolyline(removed, HORIZONTAL, DEFAULT_EPSILON));

			expect(third.polylines.map((polyline) => polyline.id)).toEqual([SECOND_ID, 'p3']);
		});

		it('頂点を有効な位置へ移動できる', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			const moved = expectOk(
				moveVertex(document, {
					polylineId: 'p1',
					index: 1,
					point: { x: OUTSIDE_RIGHT, y: MID + MID / 2 },
					epsilon: DEFAULT_EPSILON
				})
			);

			expect(moved.polylines[0].vertices[1].y).toBe(MID + MID / 2);
		});

		it('すべてのポリラインを削除できる', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			expect(clearPolylines(document).polylines).toEqual([]);
		});

		it('矩形の大きさを変更しても、ポリラインは保持される', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			const resized = expectOk(
				resizeRect(document, { width: MIN_RECT_SIZE * 2, height: MIN_RECT_SIZE * 2 })
			);

			expect(resized.polylines).toHaveLength(1);
		});
	});

	describe('異常系', () => {
		it('始点が矩形の内部にある描画は確定できない', () => {
			const draft = [{ x: MID, y: MID }, HORIZONTAL[1]];

			expect(finishPolyline(createDocument(), draft, DEFAULT_EPSILON).ok).toBe(false);
		});

		it('頂点が1個の描画は確定できない', () => {
			expect(finishPolyline(createDocument(), [HORIZONTAL[0]], DEFAULT_EPSILON).ok).toBe(false);
		});

		it('自己交差になる頂点は追加できない', () => {
			const draft: Point[] = [
				{ x: OUTSIDE, y: MID },
				{ x: OUTSIDE_RIGHT, y: MID },
				{ x: OUTSIDE_RIGHT, y: MID - SMALL_SIDE }
			];
			// 下へ回り込んだあと左上へ戻る線が、最初の水平線と交差する
			const candidate = { x: OUTSIDE, y: MID + SMALL_SIDE };

			const result = checkAddVertex(draft, candidate, {
				rect: createDocument().rect,
				epsilon: DEFAULT_EPSILON
			});

			expect(result).not.toBeNull();
		});

		it('存在しない頂点の移動は拒否する', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			const result = moveVertex(document, {
				polylineId: 'none',
				index: 0,
				point: HORIZONTAL[0],
				epsilon: DEFAULT_EPSILON
			});

			expect(result.ok).toBe(false);
		});

		it('始点を矩形の内部へ動かす移動は拒否する', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));

			const result = moveVertex(document, {
				polylineId: 'p1',
				index: 0,
				point: { x: MID, y: MID },
				epsilon: DEFAULT_EPSILON
			});

			expect(result.ok).toBe(false);
		});

		it('範囲外の矩形サイズは拒否する', () => {
			const result = resizeRect(createDocument(), { width: TOO_LARGE, height: MIN_RECT_SIZE });

			expect(result.ok).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('矩形サイズの下限と上限は受け付ける', () => {
			const low = resizeRect(createDocument(), { width: MIN_RECT_SIZE, height: MIN_RECT_SIZE });
			const high = resizeRect(createDocument(), { width: MAX_RECT_SIZE, height: MAX_RECT_SIZE });

			expect(low.ok).toBe(true);
			expect(high.ok).toBe(true);
		});

		it('矩形を縮めて始点が内側に入ったポリラインは、無効として見つかる', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));
			const shrunk = expectOk(resizeRect(document, { width: SMALL_SIDE, height: SMALL_SIDE }));

			const invalid = findInvalid(shrunk, DEFAULT_EPSILON);

			expect(findInvalid(document, DEFAULT_EPSILON)).toEqual([]);
			expect(invalid.map((entry) => entry.polylineId)).toEqual(['p1']);
		});

		it('ドラッグ中の規則では、矩形の内部を通らなくなる移動も許す', () => {
			const document = expectOk(finishPolyline(createDocument(), HORIZONTAL, DEFAULT_EPSILON));
			const away = { x: OUTSIDE_RIGHT, y: OUTSIDE_RIGHT };

			const dragging = moveVertex(document, {
				polylineId: 'p1',
				index: 1,
				point: away,
				epsilon: DEFAULT_EPSILON,
				rules: ['V-02', 'V-03', 'V-04', 'V-05']
			});
			const dropped = moveVertex(document, {
				polylineId: 'p1',
				index: 1,
				point: away,
				epsilon: DEFAULT_EPSILON
			});

			expect(dragging.ok).toBe(true);
			expect(dropped.ok).toBe(true);
		});
	});
});
