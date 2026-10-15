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
	<h2 class="text-sm font-semibold">分割</h2>
	<Button class="w-full" disabled={!editor.canPartition} onclick={() => editor.runPartition()}>
		区画分割
	</Button>
	<Button
		variant="outline"
		class="w-full"
		disabled={editor.result === null}
		onclick={() => editor.rerollColors()}>色を再抽選</Button
	>
	{#if !editor.canPartition}
		<p class="text-xs text-red-600" data-testid="partition-blocked">
			無効なポリラインがあるため、区画分割を実行できません
		</p>
	{/if}
</section>
