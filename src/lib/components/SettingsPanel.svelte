<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';
	import { validateSettings, type AppSettings } from '#lib/settings/settings.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/** 設定の入力が範囲外だったときの理由 */
	let error = $state<string | null>(null);

	/**
	 * 設定の変更を検証して反映する
	 *
	 * 範囲外なら反映せず、理由を表示する。
	 *
	 * @param next 変更後の設定の候補
	 * @returns 反映できたか
	 */
	function apply(next: AppSettings): boolean {
		const result = validateSettings(next);
		if (!result.ok) {
			error = result.reason;
			return false;
		}
		error = null;
		editor.changeSettings(result.settings);
		return true;
	}

	/**
	 * 数値の入力欄が変更されたときの処理
	 *
	 * @param event 入力欄の change イベント
	 * @param field 変更する項目
	 */
	function handleNumber(
		event: Event & { currentTarget: HTMLInputElement },
		field: 'epsilon' | 'step'
	): void {
		const input = event.currentTarget;
		const { settings } = editor;
		const value = Number(input.value);
		const isApplied =
			field === 'epsilon'
				? apply({ ...settings, epsilon: value })
				: apply({ ...settings, snap: { ...settings.snap, step: value } });
		// 範囲外のときは、入力欄を直前の値に戻す
		if (!isApplied)
			input.value = String(field === 'epsilon' ? settings.epsilon : settings.snap.step);
	}
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">設定</h2>
	<div class="space-y-1">
		<Label for="setting-epsilon">ε（同値判定の許容誤差）</Label>
		<Input
			id="setting-epsilon"
			type="number"
			step="any"
			value={editor.settings.epsilon}
			onchange={(event) => handleNumber(event, 'epsilon')}
		/>
	</div>
	<div class="flex items-center gap-2">
		<Switch
			id="setting-snap"
			checked={editor.settings.snap.enabled}
			onCheckedChange={(enabled) =>
				apply({ ...editor.settings, snap: { ...editor.settings.snap, enabled } })}
		/>
		<Label for="setting-snap">グリッドスナップ</Label>
	</div>
	<div class="space-y-1">
		<Label for="setting-step">スナップの刻み</Label>
		<Input
			id="setting-step"
			type="number"
			step="any"
			value={editor.settings.snap.step}
			onchange={(event) => handleNumber(event, 'step')}
		/>
	</div>
	{#if error !== null}
		<p class="text-xs text-red-600" role="alert" data-testid="settings-error">{error}</p>
	{/if}
	{#if !editor.isSettingsPersisted}
		<p class="text-xs text-muted-foreground" data-testid="settings-unsaved">
			設定を保存できません（この画面の間だけ有効です）
		</p>
	{/if}
</section>
