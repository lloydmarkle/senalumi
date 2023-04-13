<script lang="ts">
    import { fly, scale } from "svelte/transition";
    import { cubicOut } from 'svelte/easing';
    import { audioQueue } from "./audio-effect";
    import ExpandMenuButton from "./ExpandMenuButton.svelte";

    // some fun based on https://www.sliderrevolution.com/resources/css-hamburger-menu/
    export let isOpen = false;
    export let closeable = true;
    let open = false;

    const outerAnimDuration = 400;
    const innerAnimDuration = 400;
    // slick! https://css-tricks.com/animating-with-clip-path/
    let expand = (el: Element, props: { delay: number}) => ({
        ...props,
        duration: outerAnimDuration,
        easing: cubicOut,
        css: (t, u) => `
        clip-path: inset(0% ${u * 100}% ${u * 100}% 0% round var(--theme-border-radius));
        `,
    });
</script>

<svelte:body on:click={() => open = false} />

<div class="root"
    on:click|stopPropagation={() => null}
    on:keypress={() => null}
>
    {#if isOpen || open}
        <div class="content-container"
            class:top-padding={closeable}
            in:expand={{ delay: 0 }}
            out:expand|local={{ delay: innerAnimDuration }}
        >
            <div class="content"
                in:fly={{ y:-10, delay: outerAnimDuration, duration: innerAnimDuration }}
                out:fly|local={{ y:-10, delay: 0, duration: innerAnimDuration }}
            >
                <slot />
            </div>
        </div>
    {/if}
    {#if closeable}
        <button
            class="toggle-button"
            use:audioQueue={open ? 'menuClose' : 'menuOpen'}
            transition:scale={{ duration: outerAnimDuration }}
            on:click={() => open = !open}
        >
            <slot name="button-content" open={isOpen || open}>
                <ExpandMenuButton open={isOpen || open} />
            </slot>
        </button>
    {/if}
</div>

<style>
.root {
    /* font-size: 4em; */
    position: relative;
    z-index: 10;
    background: var(--theme-background);
    border-radius: var(--theme-border-radius);
}

.toggle-button {
    border: none;
    background: none;
    padding: 0;
    position: relative;
}

.content-container {
    left: 0em;
    top: 0em;
    padding: 1em;
    background:  var(--theme-background);
    border-radius: var(--theme-border-radius);
    position: absolute;
    transition: padding-top .3s;
}
.top-padding {
    padding-top: 4em;
}

.content {
    display: flex;
    align-items: end;
    flex-direction: row;
    gap: 1em;
}
</style>