<script lang="ts">
    import { fade } from 'svelte/transition';
    // very cool!! https://css-tricks.com/single-element-loaders-the-dots/
    export let size = 100;
    export let thickness = size / 5;
    export let color = '#07e8d6';
    const style = [
        `--loader-size:${size}px`,
        `--loader-thickness:${thickness}px`,
        `--loader-color:${color}`,
    ].join(';');
</script>

<div
    {style}
    class="loader">
</div>

<style>
    .loader {
        width: var(--loader-size);
        padding: var(--loader-thickness);

        aspect-ratio: 1;
        border-radius: 50%;
        background:
            radial-gradient(farthest-side,var(--loader-color) 94%,#0000) top/8px 8px no-repeat,
            conic-gradient(#0000 30%,var(--loader-color));
        mask: radial-gradient(farthest-side,#0000 calc(100% - 8px),#000 0);
        box-sizing: border-box;
        animation: load 1s linear infinite;
    }

    @keyframes load {
        to { transform: rotate(1turn); }
    }
</style>
