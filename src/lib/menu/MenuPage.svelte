<script lang="ts">
    import { fly } from 'svelte/transition';

    const myFly = (el: Element) => fly(el, { y: -40, duration: 400, delay: 0 });
</script>

<div transition:myFly>
    <slot/>
</div>

<style>
    div {
        background: black;
        padding: 1rem 4rem 4rem;
        align-self: center;
        justify-self: center;
        grid-row: 1;
        grid-column: 1;
    }
</style>