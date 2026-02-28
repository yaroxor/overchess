<script lang="ts">
	import { onMount } from 'svelte';

	import '$lib/style.css';
	import 'cm-chessboard/assets/chessboard.css';
	import 'cm-chessboard/assets/extensions/markers/markers.css';

	import Legend from './Legend.svelte';
	import Settings from './Settings.svelte';

	import type { OverchessApi, OverlaySettings } from '$lib/overchess';
	import { defaultSettings } from '$lib/overchess';

	let boardHost: HTMLDivElement;
	let turnEl: HTMLSpanElement;
	let statusEl: HTMLSpanElement;
	let api: OverchessApi | null = null;

	let settings: OverlaySettings = $state({ ...defaultSettings });

	// re-render overlay whenever settings change
	$effect(() => {
		if (api) api.updateOverlay(settings);
	});

	onMount(async () => {
		const mod = await import('$lib/overchess');
		api = await mod.initOverchess(boardHost, turnEl, statusEl);
		api.enableInput();
		api.updateInfo();
		api.updateOverlay(settings);
	});
</script>

<Legend />
<Settings bind:settings />

<div class="flex min-h-screen items-center justify-center bg-[#1a1a2e] text-gray-200">
	<div class="flex items-start gap-4">
		<!-- board column -->
		<div class="flex flex-col items-center gap-2">
			<div class="flex items-stretch gap-2">
				<div class="flex flex-col justify-around text-sm font-semibold text-gray-400 select-none">
					{#each [8, 7, 6, 5, 4, 3, 2, 1] as rank}
						<span>{rank}</span>
					{/each}
				</div>
				<div bind:this={boardHost} class="w-[min(85vw,85vh)]"></div>
			</div>

			<div
				class="ml-5 flex w-[min(85vw,85vh)] justify-around text-sm font-semibold text-gray-400 select-none"
			>
				{#each ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as file}
					<span>{file}</span>
				{/each}
			</div>

			<div class="flex min-h-[1.4em] gap-4 text-sm">
				<span bind:this={turnEl} class="font-semibold"></span>
				<span bind:this={statusEl} class="text-amber-400"></span>
			</div>
		</div>
	</div>
</div>
