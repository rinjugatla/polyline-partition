import { describe, expect, it } from 'vitest';
import { resolveKeyAction, type KeyInput } from './keyboard';

/** 修飾キーなし・選択モードの基本入力 */
const BASE: KeyInput = { key: '', isCtrl: false, isShift: false, mode: 'select' };

describe('キー入力の判定', () => {
	describe('正常系', () => {
		it('Ctrl+Z は undo になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'z', isCtrl: true })).toBe('undo');
		});
		it('Ctrl+Shift+Z は redo になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Z', isCtrl: true, isShift: true })).toBe('redo');
		});
		it('描画モードの Enter は描画の確定になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Enter', mode: 'draw' })).toBe('finishDraft');
		});
		it('Escape は描画の中止になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Escape' })).toBe('cancelDraft');
		});
		it('選択モードの Delete は選択中の削除になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Delete' })).toBe('deleteSelected');
		});
	});

	describe('異常系', () => {
		it('対応しないキーは null になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'a' })).toBeNull();
		});
		it('Ctrl なしの Z は null になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'z' })).toBeNull();
		});
	});

	describe('境界条件', () => {
		it('選択モードの Enter は null になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Enter', mode: 'select' })).toBeNull();
		});
		it('描画モードの Delete は null になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'Delete', mode: 'draw' })).toBeNull();
		});
		it('Ctrl+Z は描画モードでも undo になる', () => {
			expect(resolveKeyAction({ ...BASE, key: 'z', isCtrl: true, mode: 'draw' })).toBe('undo');
		});
	});
});
