import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, redo, undo } from './history';

describe('Undo / Redo の履歴', () => {
	describe('正常系', () => {
		it('記録した状態を Undo で戻し、Redo で進められる', () => {
			const history = commit(commit(createHistory('a'), 'b'), 'c');

			const undone = undo(history);
			const redone = redo(undone);

			expect(undone.present).toBe('b');
			expect(redone.present).toBe('c');
		});

		it('新しい状態を記録すると、進める未来は破棄される', () => {
			const history = undo(commit(createHistory('a'), 'b'));

			const next = commit(history, 'x');

			expect(canRedo(next)).toBe(false);
			expect(next.past).toEqual(['a']);
		});
	});

	describe('異常系', () => {
		it('履歴がないときの Undo は同じ履歴を返す', () => {
			const history = createHistory('a');

			expect(undo(history)).toBe(history);
		});

		it('未来がないときの Redo は同じ履歴を返す', () => {
			const history = createHistory('a');

			expect(redo(history)).toBe(history);
		});
	});

	describe('境界条件', () => {
		it('初期状態では戻すことも進めることもできない', () => {
			const history = createHistory('a');

			expect(canUndo(history)).toBe(false);
			expect(canRedo(history)).toBe(false);
		});

		it('すべて戻すと、戻せなくなり進められるようになる', () => {
			const history = undo(commit(createHistory('a'), 'b'));

			expect(canUndo(history)).toBe(false);
			expect(canRedo(history)).toBe(true);
		});
	});
});
