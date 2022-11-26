<script lang="ts">
    import Icon from './TeamSelectionIcon.svelte';

    export let item = undefined;
	export let isActive = false;
    export let isFirst = false;
	export let isHover = false;
    export let filterText = '';
    export let isSelectable = true;
    export let getOptionLabel = () => null;
</script>

<div class="item"
    class:active={isActive}
    class:first={isFirst}
    class:hover={isHover}
>
    <Icon color={item.value}/>
    <div class="label">{item.label}</div>
</div>

<style>
    .item {
        display: flex;
        align-items: center;
        padding: var(--itemPadding);
        cursor: default;
    }

    .item.active {
        background: var(--itemActiveBackground);
        color: var(--itemIsActiveColor);
    }
    .item:active {
        background: var(--itemIsActiveBG);
    }
    .item.first {
        border-radius: var(--itemFirstBorderRadius);
    }
    .item.hover {
        background: var(--itemHoverBG);
    }
</style>
