<script lang="ts">
    import Select from 'svelte-select'
    import Item from './TeamSelectItem.svelte'
    import Icon from './TeamSelectionIcon.svelte'

    type ItemType = { value: string, label: string };
    export let options: ItemType[];
    export let value: string;

    $: selected = options.find(e => e.value === value);
    function handleSelect(ev) {
        value = ev.detail.value;
    }
</script>

<div class="themed">
    <Select
        containerStyles={'width:12rem'}
        placeholder='';
        isClearable={false}
        isSearchable={false}
        value={selected}
        items={options}
        {Icon}
        {Item}
        iconProps={{ color: value }}
        on:select={handleSelect}
        on:select
        />
    </div>

<style>
    .themed {
        max-width: 15rem;
        --height: 3rem;
        --background: var(--theme-background-3);
        --listBackground: var(--theme-background-3);
        --itemActiveBackground: var(--theme-gradient-bg1);
        --itemHoverBG: var(--theme-gradient-bg2);
        --itemPadding: 0.25rem 0.5rem;
        --borderRadius: var(--theme-border-radius);
        --itemFirstBorderRadius: var(--theme-border-radius);
        --listBorderRadius: var(--theme-border-radius);
    }
</style>