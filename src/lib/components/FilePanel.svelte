<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { JSON_FILE_NAME, SVG_FILE_NAME } from '#lib/constants.js';
	import { downloadText } from '#lib/io/download.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();

	/** 読込用の非表示のファイル選択欄 */
	let fileInput = $state<HTMLInputElement | null>(null);

	/**
	 * 選択されたファイルを読み込む
	 *
	 * @param event ファイル選択欄の change イベント
	 */
	async function handleFile(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (file === undefined) return;
		editor.loadJsonText(await file.text());
		// 同じファイルを続けて選んでも change が発火するよう、選択を空に戻す
		input.value = '';
	}
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">保存・出力</h2>
	<Button
		variant="outline"
		class="w-full"
		onclick={() => downloadText(JSON_FILE_NAME, editor.toJson(), 'application/json')}
		>JSON 保存</Button
	>
	<Button variant="outline" class="w-full" onclick={() => fileInput?.click()}>JSON 読込</Button>
	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		class="hidden"
		data-testid="json-file-input"
		onchange={handleFile}
	/>
	<Button
		variant="outline"
		class="w-full"
		onclick={() => downloadText(SVG_FILE_NAME, editor.toSvg(), 'image/svg+xml')}>SVG 出力</Button
	>
</section>
