<script lang="ts">
    import type { Room } from "colyseus.js";
    import type { GameSchema } from "../net-game";

    export let room: Room<GameSchema>;

//    room.
</script>

<div class="status-messages">
</div>

<style>
    .status-messages {
        display: none;
        position: absolute;
        bottom: 0;
        pointer-events: all;
        padding: 1em 2em;
        border-top-left-radius: var(--theme-border-radius);
        border-top-right-radius: var(--theme-border-radius);
        background: var(--theme-gradient-background);
    }
</style>