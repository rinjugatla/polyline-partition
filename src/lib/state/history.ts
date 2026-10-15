/** Undo / Redo の履歴 */
export type History<T> = {
	/** 戻れる過去の状態（古い順） */
	readonly past: readonly T[];
	/** 現在の状態 */
	readonly present: T;
	/** 進める未来の状態（近い順） */
	readonly future: readonly T[];
};

/**
 * 履歴を作成
 *
 * @param initial 最初の状態
 * @returns 過去も未来もない履歴
 */
export function createHistory<T>(initial: T): History<T> {
	return { past: [], present: initial, future: [] };
}

/**
 * 新しい状態を記録
 *
 * 進める未来は破棄する。
 *
 * @param history 現在の履歴
 * @param next 新しい状態
 * @returns 更新後の履歴
 */
export function commit<T>(history: History<T>, next: T): History<T> {
	return { past: [...history.past, history.present], present: next, future: [] };
}

/**
 * 1つ前の状態に戻す
 *
 * @param history 現在の履歴
 * @returns 更新後の履歴。戻れないときは同じ履歴
 */
export function undo<T>(history: History<T>): History<T> {
	const previous = history.past.at(-1);
	if (previous === undefined) return history;
	return {
		past: history.past.slice(0, -1),
		present: previous,
		future: [history.present, ...history.future]
	};
}

/**
 * 1つ先の状態に進める
 *
 * @param history 現在の履歴
 * @returns 更新後の履歴。進めないときは同じ履歴
 */
export function redo<T>(history: History<T>): History<T> {
	const [following, ...rest] = history.future;
	if (following === undefined) return history;
	return { past: [...history.past, history.present], present: following, future: rest };
}

/**
 * 戻せる操作があるか
 *
 * @param history 履歴
 * @returns 戻せるか
 */
export function canUndo<T>(history: History<T>): boolean {
	return history.past.length > 0;
}

/**
 * 進める操作があるか
 *
 * @param history 履歴
 * @returns 進められるか
 */
export function canRedo<T>(history: History<T>): boolean {
	return history.future.length > 0;
}
