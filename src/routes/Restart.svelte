<script lang="ts">
	let { onRestart }: { onRestart: () => void } = $props();
</script>

<button
	onclick={onRestart}
	class="fixed right-4 bottom-4 z-50 flex h-9 w-9 items-center justify-center rounded-full
         border-2 border-gray-400 bg-white/20
         text-lg text-white transition-colors select-none hover:bg-white/35"
	aria-label="Restart game"
>
	↺
</button>
