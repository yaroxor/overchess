<script lang="ts">
	let showLegend = false;

	const whitePieces = [
		{ label: 'Pawn', color: '#b088ff' },
		{ label: 'Knight / Bishop', color: '#00d4ff' },
		{ label: 'Rook / Queen', color: '#ff00cc' },
		{ label: 'King', color: '#ffe500' }
	];
	const blackColor = '#b5412d';
</script>

<!-- fixed to top-left, never affects layout -->
<div class="fixed top-4 left-4 z-50 flex flex-col gap-3">
	<button
		onclick={() => (showLegend = !showLegend)}
		class="flex h-9 w-9 items-center justify-center rounded-full
           border-2 border-gray-400 bg-white/20
           text-base font-bold text-white
           transition-colors select-none hover:bg-white/35"
		aria-label="Toggle legend"
	>
		i
	</button>

	{#if showLegend}
		<div
			class="flex w-56 flex-col gap-4 rounded-xl border-2 border-gray-500 bg-[#2c3e63]
              p-5 text-gray-100"
		>
			<p class="text-base uppercase">Legend</p>

			<div class="flex flex-col gap-2">
				<p class="text-sm text-gray-400">Outlines — White</p>
				{#each whitePieces as { label, color }}
					<div class="flex items-center gap-3">
						<span
							class="inline-block h-5 w-5 shrink-0 rounded-sm border-[3px]"
							style="border-color:{color}"
						></span>
						<span class="text-base">{label}</span>
					</div>
				{/each}
			</div>

			<div class="flex items-center gap-3 border-t border-gray-600 pt-2">
				<span
					class="inline-block h-5 w-5 shrink-0 rounded-sm border-[3px]"
					style="border-color:{blackColor}"
				></span>
				<span class="text-base">All Black pieces</span>
			</div>

			<div class="flex flex-col gap-2 border-t border-gray-600 pt-2">
				<p class="text-sm text-gray-400">Fills</p>
				<div class="flex items-center gap-3">
					<span
						class="inline-block h-5 w-5 shrink-0 rounded-sm"
						style="background:rgba(80,200,80,0.6)"
					></span>
					<span class="text-base">White controls</span>
				</div>
				<div class="flex items-center gap-3">
					<span
						class="inline-block h-5 w-5 shrink-0 rounded-sm"
						style="background:rgba(220,60,60,0.6)"
					></span>
					<span class="text-base">Black controls</span>
				</div>
				<div class="flex items-center gap-3">
					<span
						class="inline-block h-5 w-5 shrink-0 rounded-sm"
						style="background:linear-gradient(135deg,rgba(80,200,80,0.7) 50%,rgba(220,60,60,0.7) 50%)"
					></span>
					<span class="text-base">Contested</span>
				</div>
			</div>
		</div>
	{/if}
</div>
