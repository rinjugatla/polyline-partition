import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EPSILON,
	MAX_EPSILON,
	MAX_SNAP_STEP,
	MIN_EPSILON,
	MIN_SNAP_STEP,
	SETTINGS_STORAGE_KEY
} from '../constants';
import {
	DEFAULT_SETTINGS,
	loadSettings,
	parseSettings,
	readNumericSetting,
	saveSettings,
	serializeSettings,
	validateSettings,
	withNumericSetting,
	type AppSettings,
	type SettingsStorage
} from './settings';

/** 既定値と異なる設定 */
const CUSTOM: AppSettings = { epsilon: 0.5, snap: { enabled: false, step: 25 } };
/** 範囲を超える ε */
const TOO_LARGE_EPSILON = MAX_EPSILON * 2;
/** 範囲を下回る ε */
const TOO_SMALL_EPSILON = MIN_EPSILON / 2;

/** 差し替え後の ε */
const NEW_EPSILON = 0.25;
/** 差し替え後の刻み */
const NEW_STEP = 40;

/**
 * 内容を保持する偽の保存先を生成
 *
 * @param initial 最初に入っている値
 * @returns 保存先
 */
function memoryStorage(initial: string | null = null): SettingsStorage {
	let value = initial;
	return {
		getItem: () => value,
		setItem: (_key, next) => {
			value = next;
		}
	};
}

/** 読み書きのたびに例外を投げる保存先 */
const BROKEN_STORAGE: SettingsStorage = {
	getItem: () => {
		throw new Error('使えない');
	},
	setItem: () => {
		throw new Error('使えない');
	}
};

describe('アプリ設定', () => {
	describe('正常系', () => {
		it('保存して読み込むと、同じ値になる', () => {
			const storage = memoryStorage();

			saveSettings(storage, CUSTOM);

			expect(loadSettings(storage)).toEqual({ settings: CUSTOM, isStorageAvailable: true });
		});

		it('保存データは、キーと同じ形式の JSON になる', () => {
			expect(JSON.parse(serializeSettings(CUSTOM))).toEqual({ schemaVersion: 1, ...CUSTOM });
		});
	});

	describe('異常系', () => {
		it('範囲外の ε は拒否する', () => {
			const result = validateSettings({ ...CUSTOM, epsilon: TOO_LARGE_EPSILON });

			expect(result.ok).toBe(false);
		});

		it('不正な JSON は拒否する', () => {
			expect(parseSettings('{').ok).toBe(false);
		});

		it('バージョンが違う保存データは拒否する', () => {
			expect(parseSettings(JSON.stringify({ schemaVersion: 2, ...CUSTOM })).ok).toBe(false);
		});

		it('保存データが不正なら、既定値で動作を続け、保存できない旨を返す', () => {
			const loaded = loadSettings(memoryStorage('{'));

			expect(loaded).toEqual({ settings: DEFAULT_SETTINGS, isStorageAvailable: false });
		});

		it('保存先が使えない場合は、既定値で動作を続ける', () => {
			expect(loadSettings(BROKEN_STORAGE)).toEqual({
				settings: DEFAULT_SETTINGS,
				isStorageAvailable: false
			});
			expect(loadSettings(null).isStorageAvailable).toBe(false);
		});

		it('保存先が使えない場合は、保存に失敗する', () => {
			expect(saveSettings(BROKEN_STORAGE, CUSTOM)).toBe(false);
			expect(saveSettings(null, CUSTOM)).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('保存データがないときは既定値を使い、保存先は使えるとする', () => {
			expect(loadSettings(memoryStorage())).toEqual({
				settings: DEFAULT_SETTINGS,
				isStorageAvailable: true
			});
			expect(DEFAULT_SETTINGS.epsilon).toBe(DEFAULT_EPSILON);
		});

		it('ε と刻みの下限値と上限値は受け付ける', () => {
			const lower = validateSettings({
				epsilon: MIN_EPSILON,
				snap: { enabled: true, step: MIN_SNAP_STEP }
			});
			const upper = validateSettings({
				epsilon: MAX_EPSILON,
				snap: { enabled: true, step: MAX_SNAP_STEP }
			});

			expect(lower.ok).toBe(true);
			expect(upper.ok).toBe(true);
		});

		it('下限をわずかに下回る ε と、上限を超える刻みは拒否する', () => {
			const tooSmall = validateSettings({ ...CUSTOM, epsilon: TOO_SMALL_EPSILON });
			const tooLargeStep = validateSettings({
				...CUSTOM,
				snap: { enabled: true, step: MAX_SNAP_STEP + 1 }
			});

			expect(tooSmall.ok).toBe(false);
			expect(tooLargeStep.ok).toBe(false);
		});

		it('保存先のキーは仕様で定めた名前である', () => {
			expect(SETTINGS_STORAGE_KEY).toBe('polyline-partition:settings');
		});
	});
});

describe('数値項目の差し替え', () => {
	describe('正常系', () => {
		it('epsilon を指定すると、ε だけが変わる', () => {
			const next = withNumericSetting(CUSTOM, 'epsilon', NEW_EPSILON);

			expect(next).toEqual({ ...CUSTOM, epsilon: NEW_EPSILON });
		});

		it('step を指定すると、刻みだけが変わり、スナップの ON / OFF は保たれる', () => {
			const next = withNumericSetting(CUSTOM, 'step', NEW_STEP);

			expect(next).toEqual({ ...CUSTOM, snap: { enabled: CUSTOM.snap.enabled, step: NEW_STEP } });
		});

		it('項目名から現在の値を取り出せる', () => {
			expect(readNumericSetting(CUSTOM, 'epsilon')).toBe(CUSTOM.epsilon);
			expect(readNumericSetting(CUSTOM, 'step')).toBe(CUSTOM.snap.step);
		});
	});

	describe('異常系', () => {
		it('範囲外の値で作った設定は、検証で拒否される', () => {
			const next = withNumericSetting(CUSTOM, 'epsilon', TOO_LARGE_EPSILON);

			expect(validateSettings(next).ok).toBe(false);
		});

		it('NaN で作った刻みは、検証で拒否される', () => {
			const next = withNumericSetting(CUSTOM, 'step', Number.NaN);

			expect(validateSettings(next).ok).toBe(false);
		});
	});

	describe('境界条件', () => {
		it('元の設定を書き換えない', () => {
			const before = structuredClone(CUSTOM);

			withNumericSetting(CUSTOM, 'step', NEW_STEP);
			withNumericSetting(CUSTOM, 'epsilon', NEW_EPSILON);

			expect(CUSTOM).toEqual(before);
		});

		it('上限値と下限値で作った設定は、検証を通る', () => {
			const upper = withNumericSetting(CUSTOM, 'step', MAX_SNAP_STEP);
			const lower = withNumericSetting(CUSTOM, 'epsilon', MIN_EPSILON);

			expect(validateSettings(upper).ok).toBe(true);
			expect(validateSettings(lower).ok).toBe(true);
		});
	});
});
