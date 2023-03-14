<script lang="ts">
    import { fly } from "svelte/transition";
    import { cubicOut } from 'svelte/easing';
    // some fun based on https://www.sliderrevolution.com/resources/css-hamburger-menu/
    let checked = false;

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

<div class="root">
    {#if checked}
        <div in:expand={{ delay: 0 }} out:expand={{ delay: animLen }} class="expanded">
            <div class="content" in:fly={{ y:-10, delay: animLen }} out:fly={{ y:-10, delay: 0 }}>
                <slot />
            </div>
        </div>
    {/if}
    <label class="menu">
        <input type="checkbox" bind:checked={checked}>
        <div class="bar bar1 right"></div>
        <div class="bar bar2 right"></div>
    </label>
</div>

<style>
input { display: none; }
label { cursor: pointer; }

.root {
    /* font-size: 2em; */
    position: absolute;
    background: var(--theme-background);
    border-radius: var(--theme-border-radius);
    padding: .5em;
}
.menu {
    width: 2em;
    height: 2em;
    border-radius: 100%;
    border: .2em solid var(--theme-foreground);
    position: relative;
    display: block;
}
.expanded {
    left: 0em;
    top: 0em;
    padding: 1em;
    padding-top: 4em;
    background: var(--theme-background);
    border-radius: var(--theme-border-radius);
    position: absolute;
}

.content {
    display: flex;
    flex-direction: row;
    gap: 1em;
    /* overflow-x: hidden; */
    /* animation: 1s inset reverse; */
}

.bar {
    position: absolute;
}
.bar:before {
    border-style: solid;
    border-width: 0.2em 0.2em 0 0;
    content: '';
    display: inline-block;
    position: relative;
    top: .5em;
    left: .6em;
    width: .8em;
    height: .8em;
    transform-origin: .4em .4em;
    transition: transform .5s;
    box-sizing: border-box;
}
.bar.right:before {
	transform: rotate(135deg);
}

/*
This effect doesn't look right
.menu:hover input:not(:checked) ~ .bar1:before {
    transform: translate(-.3em, 0em) rotate(45deg);
}
.menu:hover input:not(:checked) ~ .bar2:before {
    transform: translate(.2em, 0em) rotate(45deg);
}
*/
.menu:hover input:not(:checked) ~ .bar1:before {
    animation: bounce 1.5s infinite;
}
.menu:hover input:not(:checked) ~ .bar2:before {
    animation: bounce 1.5s infinite;
}

@keyframes bounce {
    0%, 100% { translate: 0em 0em; }
    20%, 60% { translate: 0em .1em; }
    40% { translate: 0em 0em; }
}

input:checked ~ .bar1:before {
    transform: translate(.5em, 0em) rotate(-135deg);
}
input:checked ~ .bar2:before {
    transform: translate(-.35em, 0em) rotate(45deg);
}
</style>