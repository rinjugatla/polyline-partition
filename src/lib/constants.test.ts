import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EPSILON,
	DEFAULT_RECT_SIZE,
	DEFAULT_SNAP_STEP,
	MAX_EPSILON,
	MAX_RECT_SIZE,
	MAX_SNAP_STEP,
	MIN_EPSILON,
	MIN_RECT_SIZE,
	MIN_SNAP_STEP
} from './constants';

describe('設定値の定数', () => {
	describe('正常系', () => {
		it('既定値が、それぞれ許容範囲の内側にある', () => {
			expect(DEFAULT_EPSILON).toBeGreaterThanOrEqual(MIN_EPSILON);
			expect(DEFAULT_EPSILON).toBeLessThanOrEqual(MAX_EPSILON);
			expect(DEFAULT_RECT_SIZE).toBeGreaterThanOrEqual(MIN_RECT_SIZE);
			expect(DEFAULT_RECT_SIZE).toBeLessThanOrEqual(MAX_RECT_SIZE);
			expect(DEFAULT_SNAP_STEP).toBeGreaterThanOrEqual(MIN_SNAP_STEP);
			expect(DEFAULT_SNAP_STEP).toBeLessThanOrEqual(MAX_SNAP_STEP);
		});
	});

	describe('異常系', () => {
		it('範囲の下限が上限を超えていない', () => {
			expect(MIN_EPSILON).toBeLessThan(MAX_EPSILON);
			expect(MIN_RECT_SIZE).toBeLessThan(MAX_RECT_SIZE);
			expect(MIN_SNAP_STEP).toBeLessThan(MAX_SNAP_STEP);
		});
	});

	describe('境界条件', () => {
		it('ε の下限と上限が仕様書の値と一致する', () => {
			expect(MIN_EPSILON).toBe(0.0001);
			expect(MAX_EPSILON).toBe(1);
		});
	});
});
