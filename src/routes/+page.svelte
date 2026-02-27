<script lang="ts">
  import '$lib/style.css';
  import 'cm-chessboard/assets/chessboard.css';
  import 'cm-chessboard/assets/extensions/markers/markers.css';

  import { onMount } from 'svelte';

  let boardHost: HTMLDivElement;
  let turnEl: HTMLSpanElement;
  let statusEl: HTMLSpanElement;

  onMount(async () => {
    const mod = await import('./overchess');
    const api = await mod.initOverchess(boardHost, turnEl, statusEl);

    api.enableInput();
    api.updateInfo();
    api.updateOverlay();
  });
</script>

<div class="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-gray-200">
  <div class="flex flex-col items-center gap-2">

    <!-- board row: rank labels + board -->
    <div class="flex gap-2 items-stretch">
      <div class="flex flex-col justify-around text-sm font-semibold text-gray-400 select-none">
        {#each [8,7,6,5,4,3,2,1] as rank}
          <span>{rank}</span>
        {/each}
      </div>

      <div bind:this={boardHost} class="w-[min(85vw,85vh)]"></div>
    </div>

    <!-- file labels -->
    <div class="flex justify-around text-sm font-semibold text-gray-400 select-none w-[min(85vw,85vh)] ml-5">
      {#each ['a','b','c','d','e','f','g','h'] as file}
        <span>{file}</span>
      {/each}
    </div>

    <!-- status -->
    <div class="flex gap-4 text-sm min-h-[1.4em]">
      <span bind:this={turnEl} class="font-semibold"></span>
      <span bind:this={statusEl} class="text-amber-400"></span>
    </div>

  </div>
</div>
