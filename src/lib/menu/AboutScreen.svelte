<script lang="ts">
    // I feel like we could format this page better but it was done in a kind of quick "let's get this out the door"
    // sort of way so I'll come back to it later.
</script>

<svelte:options runes={true} />

<div class="root">
    <section>
        <h2>What is Senalumi</h2>
        <p>
            Senalumi is a simple real-time strategy game inspired (heavily) by Ed
            <a href="https://emcneill.com/" target="_blank" rel="noreferrer">Ed McNeill's</a>
            <em>Auralux</em>. The original is hard to find these days but you can play the sequel
            <a href="http://auraluxconstellations.com/" target="_black" rel="noreferrer">Auralux: Constellations</a>.
            Personally I'm more a fan of the original so this game tends to stick closer to that.
        </p>
    </section>

    <section>
        <h2>How to play</h2>
        <p>
            Once per send, the universe pulses. Each planet(s) you control will emit a satellite. You can order the satellites to conquer other planets
            and thus produce more satellites. Some planets (indicated by grey rings) can evolve to a larger size and produce more satellites per pulse.
        </p>
        <p class="warning">
            <em>CAUTION</em>: other players will be doing the same thing and trying to conquer you. Be smart and quick!
        </p>
    </section>

    <section>
        <h2>Controls</h2>
        <p>
            Mostly you will rely on your mouse or touch screen to select satellites and send them to a destination.
            For convenience, there are also a few keyboard controls:
        </p>
        <div class="keyboard-controls">
            <div>Move view</div>
            <div class="hstack" style="gap:2rem">
                <div class="vstack">
                    <span class="key">W</span>
                    <div class="hstack">
                        <span class="key">A</span>
                        <span class="key">S</span>
                        <span class="key">D</span>
                    </div>
                </div>
                <div class="vstack">
                    <span class="key">↑</span>
                    <div class="hstack">
                        <span class="key">←</span>
                        <span class="key">↓</span>
                        <span class="key">→</span>
                    </div>
                </div>
            </div>
            <div>Zoom view</div>
            <div class="hstack">
                <span class="key">+</span>/
                <span class="key">-</span>
            </div>
            <div>Game speed</div>
            <div class="hstack">
                <span class="key">[</span>/
                <span class="key">]</span>
            </div>
        </div>
    </section>
</div>

<style>
    .root {
        display: flex;
        flex-direction: column;
        padding: 0rem 8rem;
        max-width: 60rem;
        max-height: 40rem;
        overflow-y: scroll;
    }

    .warning {
        background: rgba(255, 120, 0, .4);
        padding: 1rem 2rem;
        border-radius: var(--theme-border-radius);
    }

    .keyboard-controls {
        max-width: 40%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
    }
    .keyboard-controls .vstack {
        align-items: center;
        gap: 0;
    }
    .keyboard-controls .hstack {
        gap: 0;
    }

    .key {
        text-align: center;
        font-family: monospace;
        width: 1rem;
        height: 1rem;
        padding-bottom: .4rem;
        border: 1px solid var(--theme-foreground);
        border-radius: .2rem;
    }
</style>