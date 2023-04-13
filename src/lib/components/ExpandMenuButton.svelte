<script lang="ts">
    export let open: boolean;
</script>

<span class="menu"
    class:open={open}
>
    <div class="bar" />
    <div class="bar" />
    <div class="bar" />
</span>

<style>
    .menu {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 1em;
        gap: .25em;
        position: relative;
        transition: transform .2s;
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
</style>