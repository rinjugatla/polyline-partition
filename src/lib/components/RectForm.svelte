<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/**
	 * 入力欄の値で矩形の大きさを変更する
	 *
	 * 範囲外なら変更せず、入力欄を直前の値に戻す。
	 *
	 * @param event 入力欄の change イベント
	 * @param axis 変更する辺
	 */
	function handleChange(
		event: Event & { currentTarget: HTMLInputElement },
		axis: 'width' | 'height'
	): void {
		const input = event.currentTarget;
		const rect = { ...editor.document.rect, [axis]: Number(input.value) };
		if (!editor.setRect(rect)) input.value = String(editor.document.rect[axis]);
	}
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">基礎矩形</h2>
	<div class="grid grid-cols-2 gap-2">
		<div class="space-y-1">
			<Label for="rect-width">幅</Label>
			<Input
				id="rect-width"
				type="number"
				value={editor.document.rect.width}
				onchange={(event) => handleChange(event, 'width')}
			/>
		</div>
		<div class="space-y-1">
			<Label for="rect-height">高さ</Label>
			<Input
				id="rect-height"
				type="number"
				value={editor.document.rect.height}
				onchange={(event) => handleChange(event, 'height')}
			/>
		</div>
	</div>
</section>
