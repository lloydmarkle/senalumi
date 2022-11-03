<script lang="ts">
    import { fly } from 'svelte/transition';
</script>

<div transition:fly={{ y: -50 }}>
    <p>Debug</p>
</div>

<style>
    div {
        display: flex;
        align-items: center;
        justify-content: center;

        background: linear-gradient(to bottom, rgb(200, 200, 200, 0.3), rgb(200, 200, 200, 0.5));
        position: absolute;
        top: 0;
        left: 0;
        width: 100vw;
    }
    p {
        margin: 0;
        padding: 2rem;
        font-size: 3rem;
    }
</style>