<script lang="ts">
    import Select from 'svelte-select'
    import Item from './TeamSelectItem.svelte'
    import Icon from './TeamSelectionIcon.svelte'

    type ItemType = { value: string, label: string };
    export let options: ItemType[];
    export let value: string;

    let selected = options.find(e => e.value === value);
    function handleSelect(ev) {
        value = ev.detail.value;
    }
</script>

<div class="themed">
    <Select
        placeholder='';
        isClearable={false}
        isSearchable={false}
        listAutoWidth={false}
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
        --background: black;
        --listBackground: black;
        --itemActiveBackground: rgba(200, 200, 200, 0.4);
        --itemHoverBG: rgba(200, 200, 200, 0.2);
        --itemPadding: 0.25rem 0.5rem;
        --borderRadius: 0px;
        --itemFirstBorderRadius: 0px;
        --listBorderRadius: 0px;
    }
</style>