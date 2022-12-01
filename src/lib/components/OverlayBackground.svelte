<script lang="ts">
    import { fly } from 'svelte/transition';

    export let blurStrength = 4;

    let blurBackground = false;
</script>

<div style="--blur-strength:{blurStrength}px"
    class="container"
    class:container-visible={blurBackground}
    on:introend={() => blurBackground = true }
    on:outroend={() => blurBackground = false }
    transition:fly={{ y: (window.innerHeight * -0.8) }}
>
    <slot />
</div>

<style>
    .container {
        display: flex;
        align-items: center;
        justify-content: center;

        transition: backdrop-filter 2s;
        backdrop-filter: blur(var(--blur-strength)) opacity(0);
        background: linear-gradient(to bottom, rgb(200, 200, 200, 0.1), rgb(200, 200, 200, 0.3));
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
    }
    .container-visible {
        backdrop-filter: blur(var(--blur-strength)) opacity(1);
    }
</style>