<script lang="ts">
    import { teamColor } from '../data';
    import type { Team } from '../game';
    export let size = 48;
    export let color = 'red';
    $: fillColor = '#' + teamColor(color as Team).toString(16);

    const mid = size / 2;
    const csize = size / 3;
</script>
<svg
  aria-hidden="true"
  width="{size}px"
  height="{size}px"
  viewBox="0 0 {size} {size}"
  xmlns="http://www.w3.org/2000/svg">
  <circle cx="{mid}" cy="{mid + 1}" r="{csize}" fill="{fillColor}"/>
</svg>
