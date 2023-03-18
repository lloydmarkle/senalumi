<script lang="ts">
    import { fly, scale } from "svelte/transition";
    import { cubicOut } from 'svelte/easing';

    // some fun based on https://www.sliderrevolution.com/resources/css-hamburger-menu/
    export let isOpen = false;
    export let closeable = true;
    let open = false;

    const animLen = 400;
    // slick! https://css-tricks.com/animating-with-clip-path/
    let expand = (el: Element, props: { delay: number}) => ({
        ...props,
        duration: animLen,
        easing: cubicOut,
        css: (t, u) => `
        clip-path: inset(0% ${u * 100}% ${Math.min(100, u * 70)}% 0% round var(--theme-border-radius));
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
            out:expand|local={{ delay: animLen }}
        >
            <div class="content" in:fly={{ y:-10, delay: animLen }} out:fly|local={{ y:-10, delay: 0 }}>
                <slot />
            </div>
        </div>
    {/if}
    {#if closeable}
        <button
            class="menu"
            class:open={isOpen || open}
            transition:scale={{ duration: animLen }}
            on:click={() => open = !open }
        >
            <div class="bar" />
            <div class="bar" />
            <div class="bar" />
        </button>
    {/if}
</div>

<style>
.root {
    /* font-size: 4em; */
    position: absolute;
    background: var(--theme-background);
    border-radius: var(--theme-border-radius);
}

.menu {
    background: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 1em;
    gap: .25em;
    position: relative;
    transition: transform .2s;
    border: none;
}
.menu:active {
    transform: translate(0, .1em) scale(0.9);
}
.bar {
    width: 2em;
    height: .25em;
    border-radius: var(--theme-border-radius);
    background: var(--theme-foreground);
    transition: transform 350ms, opacity 350ms;
}

.menu::before {
    content: '';
    position: absolute;
    width: 2.2em;
    height: 2.2em;
    left: .5em;
    top: 0.4em;
    border-radius: 100%;
    opacity: 0;
    transition: opacity .2s;
    border: .15em solid var(--theme-foreground);
}
.menu.open::before {
    opacity: .8;
}
.menu.open .bar {
    width: 1.5em;
    transform: translate(0, -.5em) rotate(45deg);
}
.menu.open .bar:nth-child(1) {
    transform: translate(0, .5em) rotate(135deg);
}
.menu.open .bar:nth-child(2) {
    transform: rotate(225deg);
    opacity: 0;
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