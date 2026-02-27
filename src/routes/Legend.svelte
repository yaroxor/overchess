<script lang="ts">
  let showLegend = false

  const whitePieces = [
    { label: 'Pawn',            color: '#b088ff' },
    { label: 'Knight / Bishop', color: '#00d4ff' },
    { label: 'Rook / Queen',    color: '#ff00cc' },
    { label: 'King',            color: '#ffe500' },
  ]
  const blackColor = '#ff2222'
</script>

<!-- fixed to top-left, never affects layout -->
<div class="fixed top-4 left-4 flex flex-col gap-3 z-50">

  <button
    onclick={() => showLegend = !showLegend}
    class="w-9 h-9 rounded-full text-white font-bold text-base
           border-2 border-gray-400 bg-white/20
           hover:bg-white/35 transition-colors select-none
           flex items-center justify-center"
    aria-label="Toggle legend"
  >
    i
  </button>

  {#if showLegend}
  <div class="flex flex-col gap-4 bg-[#2c3e63] border-2 border-gray-500 rounded-xl p-5
              text-gray-100 w-56">

    <p class="text-base uppercase">Legend</p>

    <div class="flex flex-col gap-2">
      <p class="text-gray-400 text-sm">Outlines — White</p>
      {#each whitePieces as { label, color }}
        <div class="flex items-center gap-3">
          <span class="inline-block w-5 h-5 rounded-sm shrink-0 border-[3px]"
                style="border-color:{color}"></span>
          <span class="text-base">{label}</span>
        </div>
      {/each}
    </div>

    <div class="flex items-center gap-3 pt-2 border-t border-gray-600">
      <span class="inline-block w-5 h-5 rounded-sm shrink-0 border-[3px]"
            style="border-color:{blackColor}"></span>
      <span class="text-base">All Black pieces</span>
    </div>

    <div class="flex flex-col gap-2 pt-2 border-t border-gray-600">
      <p class="text-gray-400 text-sm">Fills</p>
      <div class="flex items-center gap-3">
        <span class="inline-block w-5 h-5 rounded-sm shrink-0"
              style="background:rgba(80,200,80,0.6)"></span>
        <span class="text-base">White controls</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="inline-block w-5 h-5 rounded-sm shrink-0"
              style="background:rgba(220,60,60,0.6)"></span>
        <span class="text-base">Black controls</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="inline-block w-5 h-5 rounded-sm shrink-0"
              style="background:linear-gradient(135deg,rgba(80,200,80,0.7) 50%,rgba(220,60,60,0.7) 50%)"></span>
        <span class="text-base">Contested</span>
      </div>
    </div>

  </div>
  {/if}

</div>
