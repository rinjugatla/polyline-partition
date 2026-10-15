import {
	DEFAULT_EPSILON,
	DEFAULT_SNAP_ENABLED,
	DEFAULT_SNAP_STEP,
	MAX_EPSILON,
	MAX_SNAP_STEP,
	MIN_EPSILON,
	MIN_SNAP_STEP,
	SETTINGS_SCHEMA_VERSION,
	SETTINGS_STORAGE_KEY
} from '../constants';
import type { SnapSettings } from '../geometry/types';

/** アプリ設定。localStorage に保存し、JSON ドキュメントには含めない */
export type AppSettings = {
	/** 同値判定の許容誤差 ε */
	readonly epsilon: number;
	/** グリッドスナップの設定 */
	readonly snap: SnapSettings;
};

/** localStorage のうち、設定の保存に使う部分 */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** 設定の検証に成功した結果 */
export type SettingsValid = {
	/** 成功を表す印 */
	readonly ok: true;
	/** 検証済みの設定 */
	readonly settings: AppSettings;
};

/** 設定の検証に失敗した結果 */
export type SettingsInvalid = {
	/** 失敗を表す印 */
	readonly ok: false;
	/** 利用者に見せる日本語の理由 */
	readonly reason: string;
};

/** 設定の検証結果（想定内の失敗なので判別共用体で返す） */
export type SettingsValidation = SettingsValid | SettingsInvalid;

/** 読み込んだ設定 */
export type LoadedSettings = {
	/** 使う設定（読み込めなければ既定値） */
	readonly settings: AppSettings;
	/** 保存先から正しく読み込めたか（保存できない旨の表示に使う） */
	readonly isStorageAvailable: boolean;
};

/** 既定の設定 */
export const DEFAULT_SETTINGS: AppSettings = {
	epsilon: DEFAULT_EPSILON,
	snap: { enabled: DEFAULT_SNAP_ENABLED, step: DEFAULT_SNAP_STEP }
};

/**
 * 値が範囲内の有限な数か
 *
 * @param value 調べる値
 * @param min 下限
 * @param max 上限
 * @returns 範囲内の数か
 */
function isNumberInRange(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * 値がオブジェクトか
 *
 * @param value 調べる値
 * @returns null でないオブジェクトか
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * 設定の候補を検証
 *
 * 型と数値の範囲を調べる。範囲は ε が 0.0001〜1、スナップの刻みが 0.1〜1000（仕様書 第6章）。
 *
 * @param candidate 検証する値（保存データや入力欄から得た値）
 * @returns 検証済みの設定。不正なら理由
 */
export function validateSettings(candidate: unknown): SettingsValidation {
	if (!isRecord(candidate) || !isRecord(candidate.snap)) {
		return { ok: false, reason: '設定の形式が正しくありません' };
	}
	const { epsilon, snap } = candidate;
	if (!isNumberInRange(epsilon, MIN_EPSILON, MAX_EPSILON)) {
		return { ok: false, reason: `ε は ${MIN_EPSILON} 以上 ${MAX_EPSILON} 以下にしてください` };
	}
	if (typeof snap.enabled !== 'boolean') {
		return { ok: false, reason: 'スナップの ON / OFF が正しくありません' };
	}
	if (!isNumberInRange(snap.step, MIN_SNAP_STEP, MAX_SNAP_STEP)) {
		return {
			ok: false,
			reason: `スナップの刻みは ${MIN_SNAP_STEP} 以上 ${MAX_SNAP_STEP} 以下にしてください`
		};
	}
	return { ok: true, settings: { epsilon, snap: { enabled: snap.enabled, step: snap.step } } };
}

/**
 * 設定を保存用の JSON 文字列にする
 *
 * @param settings 保存する設定
 * @returns JSON 文字列
 */
export function serializeSettings(settings: AppSettings): string {
	return JSON.stringify({ schemaVersion: SETTINGS_SCHEMA_VERSION, ...settings });
}

/**
 * 保存された JSON 文字列から設定を復元
 *
 * @param raw 保存された文字列
 * @returns 検証済みの設定。不正なら理由
 */
export function parseSettings(raw: string): SettingsValidation {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ok: false, reason: '設定の JSON が正しくありません' };
	}
	if (!isRecord(parsed) || parsed.schemaVersion !== SETTINGS_SCHEMA_VERSION) {
		return { ok: false, reason: '設定のバージョンが一致しません' };
	}
	return validateSettings(parsed);
}

/**
 * 保存先から設定を読み込む
 *
 * 保存先が使えない、データが不正な場合は既定値で動作を続ける。保存データがないだけなら
 * 初回の起動なので、保存先は使えるものとして扱う。
 *
 * @param storage 保存先。使えないときは null
 * @returns 使う設定と、保存先が使えるか
 */
export function loadSettings(storage: SettingsStorage | null): LoadedSettings {
	if (storage === null) return { settings: DEFAULT_SETTINGS, isStorageAvailable: false };

	let raw: string | null;
	try {
		raw = storage.getItem(SETTINGS_STORAGE_KEY);
	} catch {
		return { settings: DEFAULT_SETTINGS, isStorageAvailable: false };
	}
	if (raw === null) return { settings: DEFAULT_SETTINGS, isStorageAvailable: true };

	const parsed = parseSettings(raw);
	return parsed.ok
		? { settings: parsed.settings, isStorageAvailable: true }
		: { settings: DEFAULT_SETTINGS, isStorageAvailable: false };
}

/**
 * 設定を保存先に書き込む
 *
 * @param storage 保存先。使えないときは null
 * @param settings 保存する設定
 * @returns 保存できたか
 */
export function saveSettings(storage: SettingsStorage | null, settings: AppSettings): boolean {
	if (storage === null) return false;
	try {
		storage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(settings));
		return true;
	} catch {
		return false;
	}
}
