<script lang="ts">
	import type { OverlaySettings } from './overchess';

	let { settings = $bindable() }: { settings: OverlaySettings } = $props();
	let showSettings = $state(false);
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col items-end gap-3">
	<button
		onclick={() => (showSettings = !showSettings)}
		class="flex h-9 w-9 items-center justify-center rounded-full
           border-2 border-gray-400 bg-white/20
           text-lg text-white transition-colors select-none hover:bg-white/35"
		aria-label="Toggle settings"
	>
		⚙
	</button>

	{#if showSettings}
		<div
			class="flex w-56 flex-col gap-5 rounded-xl border-2 border-gray-500 bg-[#2c3e63]
              p-5 text-gray-100"
		>
			<p class="text-base uppercase">Settings</p>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-gray-400">Show outlines for</p>
				<div class="flex gap-2">
					{#each ['white', 'black', 'both'] as side}
						<button
							onclick={() => (settings.side = side as OverlaySettings['side'])}
							class="flex-1 rounded border py-1 text-sm font-semibold transition-colors
                   {settings.side === side
								? 'border-white bg-white/20 text-white'
								: 'border-gray-600 text-gray-400 hover:border-gray-400'}"
						>
							{side.charAt(0).toUpperCase() + side.slice(1)}
						</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-gray-400">Outline style</p>
				<div class="flex gap-2">
					{#each ['squares', 'arrows'] as style}
						<button
							onclick={() => (settings.style = style as OverlaySettings['style'])}
							class="flex-1 rounded border py-1 text-sm font-semibold transition-colors
                   {settings.style === style
								? 'border-white bg-white/20 text-white'
								: 'border-gray-600 text-gray-400 hover:border-gray-400'}"
						>
							{style.charAt(0).toUpperCase() + style.slice(1)}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
