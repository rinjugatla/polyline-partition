<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { EditorState } from '#lib/state/editor.svelte.js';

	/** props */
	type Props = {
		/** 編集の状態 */
		editor: EditorState;
	};

	let { editor }: Props = $props();
</script>

<section class="space-y-2">
	<h2 class="text-sm font-semibold">ツール</h2>
	<div class="grid grid-cols-2 gap-2">
		<Button
			variant={editor.mode === 'select' ? 'default' : 'outline'}
			aria-pressed={editor.mode === 'select'}
			onclick={() => editor.setMode('select')}>選択</Button
		>
		<Button
			variant={editor.mode === 'draw' ? 'default' : 'outline'}
			aria-pressed={editor.mode === 'draw'}
			onclick={() => editor.setMode('draw')}>描画</Button
		>
		<Button variant="outline" disabled={!editor.canUndo} onclick={() => editor.undo()}>Undo</Button>
		<Button variant="outline" disabled={!editor.canRedo} onclick={() => editor.redo()}>Redo</Button>
	</div>
	<Button
		variant="outline"
		class="w-full"
		disabled={editor.document.polylines.length === 0}
		onclick={() => editor.clearAll()}>全削除</Button
	>
</section>
