<script lang="ts">
    import type { Renderer } from '../render';
    export let gfx: Renderer;
    let viewport = gfx?.transform;
</script>

{#if $viewport}
<div class="viewport-content-container">
    <div class="viewport-transform" style="transform:translate({$viewport.tx}px, {$viewport.ty}px) scale({$viewport.scale})">
        <slot />
    </div>
</div>
{/if}

<style>
  .viewport-content-container {
    pointer-events: none;
    position: absolute;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .viewport-transform {
    top: 0; left: 0;
    position: absolute;
    pointer-events: auto;
    transform-origin: 0 0;
    padding: 0;
    margin: 0;
  }
</style>