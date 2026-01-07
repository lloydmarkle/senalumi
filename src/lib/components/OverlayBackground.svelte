<script lang="ts">
    import { fly } from 'svelte/transition';

    export let blurStrength = 4;
    export let blurBackground = false;
    // make sure to use "local" for transition: https://github.com/sveltejs/svelte/issues/7119
</script>

<div style="--blur-strength:{blurStrength}px"
    class="container"
    class:container-visible={blurBackground}
    on:introend={() => blurBackground = true }
    on:outrostart={() => blurBackground = false }
    transition:fly|local={{ y: (window.innerHeight * -0.8) }}
>
    <slot />
</div>

<style>
    .container {
        transition: backdrop-filter 2s;
        backdrop-filter: blur(var(--blur-strength)) opacity(0);
        background: linear-gradient(to bottom, rgb(200, 200, 200, 0.1), rgb(200, 200, 200, 0.3));
        position: absolute;
        inset: 0;
    }
    .container-visible {
        backdrop-filter: blur(var(--blur-strength)) opacity(1);
    }
</style>