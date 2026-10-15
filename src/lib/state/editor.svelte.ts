import { assignColors } from '../color/colors';
import { MAX_COLOR_SEED } from '../constants';
import { partition, type PartitionResult } from '../geometry/partition';
import { resolveInputPoint } from '../geometry/snap';
import type { Point, RectSize } from '../geometry/types';
import { parseDocument, serializeDocument } from '../io/json';
import { exportSvg } from '../io/svg';
import {
	DEFAULT_SETTINGS,
	loadSettings,
	saveSettings,
	type AppSettings,
	type SettingsStorage
} from '../settings/settings';
import { createDocument, type DocumentState } from './document';
import {
	checkAddVertex,
	clearPolylines,
	finishPolyline,
	findInvalid,
	moveVertex,
	removePolyline,
	resizeRect
} from './documentOps';
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from './history';
import type { KeyAction } from './keyboard';

/** 操作モード */
export type EditorMode = 'select' | 'draw';

/** 頂点のドラッグ中の状態 */
type DragState = {
	/** 動かしているポリラインの ID */
	readonly polylineId: string;
	/** 動かしている頂点の添字 */
	readonly index: number;
	/** 違反がなかった直近の位置 */
	readonly point: Point;
};

/** ドラッグ中に検査する規則（V-06 は確定時に検査する） */
const DRAG_RULES = ['V-02', 'V-03', 'V-04', 'V-05'] as const;

/**
 * 編集の状態
 *
 * ドキュメント、Undo / Redo の履歴、操作モード、選択、描画中の頂点、分割結果を持つ。
 * 画面（コンポーネント）は表示と入力の橋渡しに徹し、判断はこのクラスの関数に任せる。
 */
export class EditorState {
	/** ドキュメントの履歴 */
	#history = $state.raw<History<DocumentState>>(createHistory(createDocument()));

	/** アプリ設定 */
	settings = $state.raw<AppSettings>(DEFAULT_SETTINGS);

	/** 操作モード */
	mode = $state<EditorMode>('select');

	/** 選択中のポリラインの ID */
	selectedId = $state<string | null>(null);

	/** 描画中の頂点 */
	draft = $state.raw<readonly Point[]>([]);

	/** 利用者に見せる直近のエラー */
	message = $state<string | null>(null);

	/** 分割結果。未分割なら null */
	result = $state.raw<PartitionResult | null>(null);

	/** プレビュー線の終点（補正後の論理座標） */
	previewPoint = $state.raw<Point | null>(null);

	/** 頂点のドラッグ中の状態 */
	#drag = $state.raw<DragState | null>(null);

	/** 履歴の現在のドキュメント（ドラッグ中の位置は含まない） */
	committed = $derived(this.#history.present);

	/** 表示するドキュメント（ドラッグ中の位置を反映する） */
	document = $derived.by(() => {
		const drag = this.#drag;
		if (drag === null) return this.committed;
		return {
			...this.committed,
			polylines: this.committed.polylines.map((polyline) =>
				polyline.id === drag.polylineId
					? {
							...polyline,
							vertices: polyline.vertices.map((vertex, i) =>
								i === drag.index ? drag.point : vertex
							)
						}
					: polyline
			)
		};
	});

	/** 無効なポリラインの ID と理由 */
	invalidPolylines = $derived(findInvalid(this.document, this.settings.epsilon));

	/** 選択中のポリライン。未選択、または存在しなければ null */
	selectedPolyline = $derived(
		this.document.polylines.find((polyline) => polyline.id === this.selectedId) ?? null
	);

	/** 戻せる操作があるか */
	canUndo = $derived(canUndo(this.#history));

	/** 進める操作があるか */
	canRedo = $derived(canRedo(this.#history));

	/** 区画分割を実行できるか */
	canPartition = $derived(this.invalidPolylines.length === 0);

	/**
	 * ドキュメントを記録し、分割結果を破棄
	 *
	 * @param next 新しいドキュメント
	 */
	#record(next: DocumentState): void {
		this.#history = commit(this.#history, next);
		this.result = null;
		this.message = null;
	}

	/**
	 * 操作モードを切り替える
	 *
	 * @param mode 新しいモード
	 */
	setMode(mode: EditorMode): void {
		this.mode = mode;
		this.draft = [];
		this.message = null;
	}

	/**
	 * カーソル位置を、スナップと軸拘束で補正
	 *
	 * @param point カーソル位置の論理座標
	 * @param isShiftPressed Shift が押されているか
	 * @param axisBase 軸拘束の基準の頂点
	 * @returns 補正後の座標
	 */
	resolvePoint(point: Point, isShiftPressed: boolean, axisBase: Point | null): Point {
		return resolveInputPoint({
			point,
			snap: this.settings.snap,
			axisBase,
			isAxisConstrained: isShiftPressed
		});
	}

	/**
	 * 描画中の軸拘束の基準
	 *
	 * @returns 描画中の最後の頂点。なければ null
	 */
	draftAxisBase(): Point | null {
		return this.draft.at(-1) ?? null;
	}

	/**
	 * ポインターの移動を反映
	 *
	 * ドラッグ中は頂点を動かし、描画モードではプレビュー点を更新する。
	 *
	 * @param point カーソル位置の論理座標。キャンバスの外では null
	 * @param isShiftPressed Shift が押されているか
	 */
	moveCursor(point: Point | null, isShiftPressed: boolean): void {
		const dragBase = this.dragAxisBase();
		if (dragBase !== null) {
			if (point !== null) this.dragTo(this.resolvePoint(point, isShiftPressed, dragBase));
			return;
		}
		const isPreviewable = point !== null && this.mode === 'draw';
		this.previewPoint = isPreviewable
			? this.resolvePoint(point, isShiftPressed, this.draftAxisBase())
			: null;
	}

	/**
	 * キー操作で決まった編集操作を実行
	 *
	 * @param action 編集操作
	 */
	applyKeyAction(action: KeyAction): void {
		const handlers: Record<KeyAction, () => void> = {
			undo: () => this.undo(),
			redo: () => this.redo(),
			finishDraft: () => this.finishDraft(),
			cancelDraft: () => this.cancelDraft(),
			deleteSelected: () => this.deleteSelected()
		};
		handlers[action]();
	}

	/**
	 * 描画中の頂点を追加
	 *
	 * 違反する頂点は追加せず、理由を `message` に入れる。
	 *
	 * @param point 補正済みの座標
	 * @returns 追加できたか
	 */
	addDraftVertex(point: Point): boolean {
		const failure = checkAddVertex(this.draft, point, {
			rect: this.document.rect,
			epsilon: this.settings.epsilon
		});
		if (failure !== null) {
			this.message = failure.messages.join('、');
			return false;
		}
		this.draft = [...this.draft, point];
		this.message = null;
		return true;
	}

	/** 描画を確定。違反があれば確定せず、理由を `message` に入れて描画を続ける */
	finishDraft(): void {
		const result = finishPolyline(this.committed, this.draft, this.settings.epsilon);
		if (!result.ok) {
			this.message = result.messages.join('、');
			return;
		}
		this.#record(result.document);
		this.selectedId = result.document.polylines.at(-1)?.id ?? null;
		this.draft = [];
	}

	/** 描画を中止し、描画中のポリラインを破棄 */
	cancelDraft(): void {
		this.draft = [];
		this.message = null;
	}

	/**
	 * ポリラインを選択
	 *
	 * @param id 選択するポリラインの ID。選択を外すときは null
	 */
	select(id: string | null): void {
		this.selectedId = id;
	}

	/**
	 * 頂点のドラッグを始める
	 *
	 * @param polylineId 動かすポリラインの ID
	 * @param index 動かす頂点の添字
	 */
	beginDrag(polylineId: string, index: number): void {
		const vertex = this.committed.polylines.find((p) => p.id === polylineId)?.vertices[index];
		if (vertex === undefined) return;
		this.#drag = { polylineId, index, point: vertex };
		this.selectedId = polylineId;
	}

	/**
	 * ドラッグ中の軸拘束の基準
	 *
	 * 前の頂点を基準にし、先頭の頂点では次の頂点を基準にする。
	 *
	 * @returns 基準の頂点。ドラッグ中でなければ null
	 */
	dragAxisBase(): Point | null {
		const drag = this.#drag;
		if (drag === null) return null;
		const vertices = this.committed.polylines.find((p) => p.id === drag.polylineId)?.vertices;
		return vertices?.[drag.index === 0 ? 1 : drag.index - 1] ?? null;
	}

	/**
	 * ドラッグ中の頂点を動かす
	 *
	 * 違反する位置には動かさず、直近の有効な位置にとどめて理由を `message` に入れる。
	 *
	 * @param point 補正済みの座標
	 */
	dragTo(point: Point): void {
		const drag = this.#drag;
		if (drag === null) return;
		const result = moveVertex(this.committed, {
			...drag,
			point,
			epsilon: this.settings.epsilon,
			rules: DRAG_RULES
		});
		if (!result.ok) {
			this.message = result.messages.join('、');
			return;
		}
		this.#drag = { ...drag, point };
		this.message = null;
	}

	/** ドラッグを終える。全規則を満たせば確定し、違反なら元の位置に戻す */
	endDrag(): void {
		const drag = this.#drag;
		this.#drag = null;
		if (drag === null) return;
		const result = moveVertex(this.committed, { ...drag, epsilon: this.settings.epsilon });
		if (!result.ok) {
			this.message = result.messages.join('、');
			return;
		}
		this.#record(result.document);
	}

	/**
	 * ポリラインを削除
	 *
	 * @param id 削除するポリラインの ID
	 */
	deletePolyline(id: string): void {
		this.#record(removePolyline(this.committed, id));
		if (this.selectedId === id) this.selectedId = null;
	}

	/** 選択中のポリラインを削除 */
	deleteSelected(): void {
		if (this.selectedId !== null) this.deletePolyline(this.selectedId);
	}

	/** すべてのポリラインを削除 */
	clearAll(): void {
		this.#record(clearPolylines(this.committed));
		this.selectedId = null;
	}

	/**
	 * 基礎矩形の大きさを変更
	 *
	 * @param rect 新しい大きさ
	 * @returns 変更できたか。範囲外なら変更せず、理由を `message` に入れる
	 */
	setRect(rect: RectSize): boolean {
		const result = resizeRect(this.committed, rect);
		if (!result.ok) {
			this.message = result.messages.join('、');
			return false;
		}
		this.#record(result.document);
		return true;
	}

	/** 1つ前の状態に戻す */
	undo(): void {
		this.#history = undo(this.#history);
		this.#afterHistoryMove();
	}

	/** 1つ先の状態に進める */
	redo(): void {
		this.#history = redo(this.#history);
		this.#afterHistoryMove();
	}

	/** Undo / Redo の後始末。分割結果と、存在しなくなった選択を破棄 */
	#afterHistoryMove(): void {
		this.result = null;
		this.message = null;
		this.draft = [];
		const ids = this.committed.polylines.map((polyline) => polyline.id);
		if (this.selectedId !== null && !ids.includes(this.selectedId)) this.selectedId = null;
	}

	/**
	 * アプリ設定を変更
	 *
	 * ε が変わると無効なポリラインが変わるので、分割結果は破棄する。
	 *
	 * @param settings 検証済みの新しい設定
	 */
	updateSettings(settings: AppSettings): void {
		if (settings.epsilon !== this.settings.epsilon) this.result = null;
		this.settings = settings;
	}

	/** 設定の保存先。使えないときは null */
	#storage: SettingsStorage | null = null;

	/** 設定を保存先に保存できているか（できないときは設定欄に表示する） */
	isSettingsPersisted = $state(true);

	/**
	 * 設定の保存先をつなぎ、保存済みの設定を読み込む
	 *
	 * @param storage 保存先。使えないときは null
	 */
	attachStorage(storage: SettingsStorage | null): void {
		const loaded = loadSettings(storage);
		this.#storage = storage;
		this.updateSettings(loaded.settings);
		this.isSettingsPersisted = loaded.isStorageAvailable;
	}

	/**
	 * 設定を変更して保存
	 *
	 * @param settings 検証済みの新しい設定
	 */
	changeSettings(settings: AppSettings): void {
		this.updateSettings(settings);
		this.isSettingsPersisted = saveSettings(this.#storage, settings);
	}

	/**
	 * ドキュメントを読み込む
	 *
	 * 履歴は新しく始める。読込直後は未分割になる。
	 *
	 * @param document 検証済みのドキュメント
	 */
	loadDocument(document: DocumentState): void {
		this.#history = createHistory(document);
		this.result = null;
		this.message = null;
		this.selectedId = null;
		this.draft = [];
	}

	/**
	 * JSON 文字列を読み込む
	 *
	 * 現在の ε で検証し、違反があれば読込を中止して理由を `message` に入れる。
	 *
	 * @param text JSON 文字列
	 */
	loadJsonText(text: string): void {
		const loaded = parseDocument(text, this.settings.epsilon);
		if (!loaded.ok) {
			this.message = loaded.messages.join('、');
			return;
		}
		this.loadDocument(loaded.document);
	}

	/**
	 * 現在のドキュメントを JSON 文字列にする
	 *
	 * @returns 保存用の JSON 文字列
	 */
	toJson(): string {
		return serializeDocument(this.committed);
	}

	/**
	 * 現在の状態を SVG 文字列にする
	 *
	 * @returns SVG 文書。未分割なら区画を含まない
	 */
	toSvg(): string {
		const regions = (this.result?.regions ?? []).map((region, index) => ({
			polygon: region.polygon,
			color: this.colors[index]
		}));
		return exportSvg({
			rect: this.committed.rect,
			polylines: this.committed.polylines,
			regions
		});
	}

	/** 区画の色（区画の番号順）。未分割なら空 */
	colors = $derived(
		this.result === null ? [] : assignColors(this.result.regions.length, this.committed.colorSeed)
	);

	/** 色のシードを更新して、色を再抽選。履歴には残さず、区画数は変わらない */
	rerollColors(): void {
		const present = this.#history.present;
		const colorSeed = Math.floor(Math.random() * (MAX_COLOR_SEED + 1));
		this.#history = { ...this.#history, present: { ...present, colorSeed } };
	}

	/** 区画分割を実行。無効なポリラインがあれば実行せず、理由を `message` に入れる */
	runPartition(): void {
		const outcome = partition({
			polylines: this.committed.polylines,
			rect: this.committed.rect,
			epsilon: this.settings.epsilon
		});
		if (!outcome.ok) {
			this.message = '無効なポリラインがあるため、区画分割を実行できません';
			return;
		}
		this.result = outcome.result;
		this.message = null;
	}
}
