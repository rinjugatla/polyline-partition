import type { EditorMode } from './editor.svelte';

/** キー操作が表す編集操作 */
export type KeyAction = 'undo' | 'redo' | 'finishDraft' | 'cancelDraft' | 'deleteSelected';

/** キー入力の内容 */
export type KeyInput = {
	/** 押されたキー */
	readonly key: string;
	/** Ctrl（macOS では Command）が押されているか */
	readonly isCtrl: boolean;
	/** Shift が押されているか */
	readonly isShift: boolean;
	/** 現在の操作モード */
	readonly mode: EditorMode;
};

/**
 * キー入力を編集操作にする
 *
 * @param input キー入力の内容
 * @returns 対応する編集操作。対応するものがなければ null
 */
export function resolveKeyAction(input: KeyInput): KeyAction | null {
	const { key, isCtrl, isShift, mode } = input;
	if (isCtrl && key.toLowerCase() === 'z') return isShift ? 'redo' : 'undo';
	if (key === 'Enter' && mode === 'draw') return 'finishDraft';
	if (key === 'Escape') return 'cancelDraft';
	if (key === 'Delete' && mode === 'select') return 'deleteSelected';
	return null;
}
