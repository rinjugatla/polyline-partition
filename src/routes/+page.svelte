<script lang="ts">
	import { onMount } from 'svelte';
	import Canvas from '#lib/components/Canvas.svelte';
	import PartitionPanel from '#lib/components/PartitionPanel.svelte';
	import PolylineList from '#lib/components/PolylineList.svelte';
	import RectForm from '#lib/components/RectForm.svelte';
	import SettingsPanel from '#lib/components/SettingsPanel.svelte';
	import StatsPanel from '#lib/components/StatsPanel.svelte';
	import ToolPanel from '#lib/components/ToolPanel.svelte';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { EditorState } from '#lib/state/editor.svelte.js';

	/** 編集の状態 */
	const editor = new EditorState();

	/** 起動時に、保存済みの設定を読み込む。localStorage が使えない環境では既定値で動作する */
	onMount(() => {
		try {
			editor.attachStorage(localStorage);
		} catch {
			editor.attachStorage(null);
		}
	});
</script>

<svelte:head>
	<title>polyline-partition</title>
</svelte:head>

<div class="flex h-screen">
	<aside class="w-80 shrink-0 space-y-4 overflow-y-auto border-r p-4">
		<h1 class="text-lg font-bold">polyline-partition</h1>
		{#if editor.message !== null}
			<p
				class="rounded border border-red-600 p-2 text-sm text-red-600"
				role="alert"
				data-testid="message"
			>
				{editor.message}
			</p>
		{/if}
		<RectForm {editor} />
		<Separator />
		<ToolPanel {editor} />
		<Separator />
		<PolylineList {editor} />
		<Separator />
		<PartitionPanel {editor} />
		<Separator />
		<StatsPanel {editor} />
		<Separator />
		<SettingsPanel {editor} />
	</aside>
	<main class="min-w-0 flex-1">
		<Canvas {editor} />
	</main>
</div>
