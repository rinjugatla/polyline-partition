import { describe, expect, it } from 'vitest';
import { DEFAULT_EPSILON, SETTINGS_STORAGE_KEY } from '../constants';
import type { Point } from '../geometry/types';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { EditorState } from './editor.svelte';

/** 矩形の中央の座標 */
const MID = 500;
/** 矩形の左外の座標 */
const OUTSIDE = -50;
/** 矩形の右外の座標 */
const OUTSIDE_RIGHT = 1050;
/** 十字の2本目の上下の外側の座標 */
const OUTSIDE_TOP = 1050;
/** 十字の2本目の下の外側の座標 */
const OUTSIDE_BOTTOM = -50;
/** 縮めた後の矩形の一辺 */
const SMALL_SIDE = 100;
/** 範囲外の矩形の一辺 */
const TOO_LARGE = 20000;
/** 区画が2つに分かれる区画数 */
const TWO_REGIONS = 2;
/** 十字の区画数 */
const CROSS_REGIONS = 4;
/** ドラッグで動かす先の y 座標 */
const DRAGGED_Y = 700;

/**
 * 水平線を描いて確定した状態の編集を作る
 *
 * @returns 水平線が1本ある編集
 */
function editorWithHorizontal(): EditorState {
	const editor = new EditorState();
	editor.setMode('draw');
	editor.addDraftVertex({ x: OUTSIDE, y: MID });
	editor.addDraftVertex({ x: OUTSIDE_RIGHT, y: MID });
	editor.finishDraft();
	return editor;
}

/**
 * 垂直線を追加で描く
 *
 * @param editor 編集
 */
function drawVertical(editor: EditorState): void {
	editor.addDraftVertex({ x: MID, y: OUTSIDE_BOTTOM });
	editor.addDraftVertex({ x: MID, y: OUTSIDE_TOP });
	editor.finishDraft();
}

describe('編集の状態', () => {
	describe('正常系', () => {
		it('起動時の操作モードは描画になる', () => {
			const editor = new EditorState();

			expect(editor.mode).toBe('draw');
		});

		it('描画を確定すると、ポリラインが増えて選択される', () => {
			const editor = editorWithHorizontal();

			expect(editor.document.polylines).toHaveLength(1);
			expect(editor.selectedId).toBe('p1');
			expect(editor.draft).toEqual([]);
		});

		it('0本でも区画分割でき、区画数は1になる', () => {
			const editor = new EditorState();

			editor.runPartition();

			expect(editor.result?.regions).toHaveLength(1);
		});

		it('十字に描いて分割すると4区画になる', () => {
			const editor = editorWithHorizontal();
			drawVertical(editor);

			editor.runPartition();

			expect(editor.result?.regions).toHaveLength(CROSS_REGIONS);
		});

		it('分割後に編集すると、結果が破棄されて未分割に戻る', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();

			editor.deletePolyline('p1');

			expect(editor.result).toBeNull();
		});

		it('Undo で本数が戻り、Redo で再び増える', () => {
			const editor = editorWithHorizontal();

			editor.undo();
			expect(editor.document.polylines).toHaveLength(0);
			editor.redo();

			expect(editor.document.polylines).toHaveLength(1);
		});

		it('履歴がないときは Undo も Redo もできない', () => {
			const editor = new EditorState();

			expect(editor.canUndo).toBe(false);
			expect(editor.canRedo).toBe(false);
		});

		it('頂点をドラッグして離すと、位置が確定して履歴に残る', () => {
			const editor = editorWithHorizontal();

			editor.beginDrag('p1', 1);
			editor.dragTo({ x: OUTSIDE_RIGHT, y: DRAGGED_Y });
			editor.endDrag();

			expect(editor.document.polylines[0].vertices[1].y).toBe(DRAGGED_Y);
			expect(editor.canUndo).toBe(true);
		});

		it('ドラッグの軸拘束は、先頭の頂点では次の頂点を基準にする', () => {
			const editor = editorWithHorizontal();

			editor.beginDrag('p1', 0);

			expect(editor.dragAxisBase()).toEqual({ x: OUTSIDE_RIGHT, y: MID });
		});

		it('全削除と選択中の削除ができる', () => {
			const editor = editorWithHorizontal();
			drawVertical(editor);

			editor.deleteSelected();
			expect(editor.document.polylines).toHaveLength(1);
			editor.clearAll();

			expect(editor.document.polylines).toHaveLength(0);
		});
	});

	describe('異常系', () => {
		it('始点が矩形の内部にある描画は確定できず、理由が出て描画を続けられる', () => {
			const editor = new EditorState();
			editor.setMode('draw');
			editor.addDraftVertex({ x: MID, y: MID });
			editor.addDraftVertex({ x: OUTSIDE_RIGHT, y: MID });

			editor.finishDraft();

			expect(editor.message).not.toBeNull();
			expect(editor.draft).toHaveLength(TWO_REGIONS);
			expect(editor.document.polylines).toHaveLength(0);
		});

		it('自己交差になる頂点は追加されず、理由が出る', () => {
			const editor = new EditorState();
			editor.setMode('draw');
			const points: Point[] = [
				{ x: OUTSIDE, y: MID },
				{ x: OUTSIDE_RIGHT, y: MID },
				{ x: OUTSIDE_RIGHT, y: MID - SMALL_SIDE }
			];
			for (const point of points) editor.addDraftVertex(point);

			const isAdded = editor.addDraftVertex({ x: OUTSIDE, y: MID + SMALL_SIDE });

			expect(isAdded).toBe(false);
			expect(editor.message).not.toBeNull();
		});

		it('範囲外の矩形サイズは拒否され、矩形は変わらない', () => {
			const editor = new EditorState();

			const isChanged = editor.setRect({ width: TOO_LARGE, height: TOO_LARGE });

			expect(isChanged).toBe(false);
			expect(editor.message).not.toBeNull();
		});

		it('矩形を縮めて無効になったポリラインがあると、区画分割を実行できない', () => {
			const editor = editorWithHorizontal();

			editor.setRect({ width: SMALL_SIDE, height: SMALL_SIDE });
			editor.runPartition();

			expect(editor.canPartition).toBe(false);
			expect(editor.result).toBeNull();
		});

		it('Esc 相当の中止で、描画中のポリラインが破棄される', () => {
			const editor = new EditorState();
			editor.setMode('draw');
			editor.addDraftVertex({ x: OUTSIDE, y: MID });

			editor.cancelDraft();

			expect(editor.draft).toEqual([]);
		});
	});

	describe('境界条件', () => {
		it('違反する位置へのドラッグは反映されず、離すと元の位置のまま残る', () => {
			const editor = editorWithHorizontal();

			editor.beginDrag('p1', 0);
			editor.dragTo({ x: MID, y: MID });
			editor.endDrag();

			expect(editor.document.polylines[0].vertices[0]).toEqual({ x: OUTSIDE, y: MID });
			expect(editor.canUndo).toBe(true);
		});

		it('ε を変更すると、分割結果が破棄される', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();

			editor.updateSettings({ ...DEFAULT_SETTINGS, epsilon: DEFAULT_EPSILON * TWO_REGIONS });

			expect(editor.result).toBeNull();
		});

		it('スナップだけの変更では、分割結果は残る', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();

			editor.updateSettings({ ...DEFAULT_SETTINGS, snap: { enabled: false, step: 1 } });

			expect(editor.result).not.toBeNull();
		});

		it('ドキュメントを読み込むと、履歴が新しくなり未分割になる', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();
			const loaded = editor.document;

			editor.loadDocument(loaded);

			expect(editor.canUndo).toBe(false);
			expect(editor.result).toBeNull();
		});
	});
});

/** 設定の保存先として使う、メモリ上の疑似ストレージ */
function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value)
	};
}

/** 例外を投げる保存先 */
const BROKEN_STORAGE = {
	getItem: () => {
		throw new Error('使えない');
	},
	setItem: () => {
		throw new Error('使えない');
	}
};

describe('編集の状態: 保存・出力・設定', () => {
	describe('正常系', () => {
		it('JSON に保存して読み込むと、同じドキュメントで未分割になる', () => {
			const editor = editorWithHorizontal();
			const json = editor.toJson();
			const other = new EditorState();

			other.loadJsonText(json);

			expect(other.document).toEqual(editor.document);
			expect(other.result).toBeNull();
		});

		it('分割後の SVG に区画数と同じ数の polygon が入る', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();

			const svg = editor.toSvg();

			expect(svg.split('<polygon').length - 1).toBe(TWO_REGIONS);
		});

		it('色を再抽選すると、区画数を保ったまま色のシードが変わり、履歴には残らない', () => {
			const editor = editorWithHorizontal();
			editor.runPartition();
			const before = editor.document.colorSeed;
			const undoable = editor.canUndo;

			editor.rerollColors();

			expect(editor.document.colorSeed).not.toBe(before);
			expect(editor.colors).toHaveLength(TWO_REGIONS);
			expect(editor.canUndo).toBe(undoable);
		});

		it('保存先をつなぐと、保存済みの設定を読み込む', () => {
			const saved = { ...DEFAULT_SETTINGS, epsilon: 0.5 };
			const storage = memoryStorage();
			const first = new EditorState();
			first.attachStorage(storage);
			first.changeSettings(saved);
			const second = new EditorState();

			second.attachStorage(storage);

			expect(second.settings.epsilon).toBe(saved.epsilon);
			expect(storage.data.has(SETTINGS_STORAGE_KEY)).toBe(true);
		});
	});

	describe('異常系', () => {
		it('不正な JSON は読み込まず、理由を表示してドキュメントを保つ', () => {
			const editor = editorWithHorizontal();
			const before = editor.document;

			editor.loadJsonText('{');

			expect(editor.message).not.toBeNull();
			expect(editor.document).toBe(before);
		});

		it('保存先が使えないと、既定値で動作し保存できない印が付く', () => {
			const editor = new EditorState();

			editor.attachStorage(BROKEN_STORAGE);

			expect(editor.settings).toEqual(DEFAULT_SETTINGS);
			expect(editor.isSettingsPersisted).toBe(false);
		});

		it('保存先が null のとき、設定を変更しても保存できない印が付く', () => {
			const editor = new EditorState();
			editor.attachStorage(null);

			editor.changeSettings({ ...DEFAULT_SETTINGS, epsilon: 0.5 });

			expect(editor.isSettingsPersisted).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('未分割の SVG には polygon が入らない', () => {
			const editor = editorWithHorizontal();

			expect(editor.toSvg()).not.toContain('<polygon');
		});

		it('保存データがない保存先では既定値で保存できる印が付く', () => {
			const editor = new EditorState();

			editor.attachStorage(memoryStorage());

			expect(editor.settings).toEqual(DEFAULT_SETTINGS);
			expect(editor.isSettingsPersisted).toBe(true);
		});
	});
});
