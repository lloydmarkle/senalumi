<script lang="ts">
    export let size = 48;
    export let color = 'red';
    import { teamColor, type Team } from '../game'
    $: fillColor = '#' + teamColor(color as Team).toString(16);

    const csize = size / 3;
</script>
<svg
  width="{size}px"
  height="{size}px"
  viewBox="0 0 {size} {size}"
  xmlns="http://www.w3.org/2000/svg">
  <circle cx="{csize}" cy="{csize + size / 6}" r="{csize}" fill="{fillColor}"/>
</svg>
