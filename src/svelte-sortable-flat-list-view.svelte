<!----------------------------------------------------------------------------//
//                       Svelte Sortable Flat List View                       //
//----------------------------------------------------------------------------->

<svelte:options accessors={true}/>

<style>
  .List {
    display:inline-block; position:relative;
    margin:0px; padding:0px;
    list-style:none;
  }

  .List > li {
    display:block; position:relative;
    margin:0px; padding:0px;
    list-style:none;
  }

  li.centered {
    display:flex; position:absolute;
    left:0px; top:0px; right:0px; height:100%; /* bottom:0px seems to fail */
    flex-flow:column nowrap; justify-content:center; align-items:center;
  }
</style>

<script lang="ts">
  import {
    throwError,
    ValueIsNonEmptyString, ValueIsFunction, ValueIsList,
    allowNonEmptyString, allowedNonEmptyString, allowedList
  } from 'javascript-interface-library'

  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  let ClassNames:string; export { ClassNames as class } // used to ctrl. styling
  export let style:string                                                // dto.

  export let List:any[]                           // the (flat) list to be shown
  export let Key:string|Function|undefined   // the value to be used as list key
  export let Placeholder:string|undefined         // is shown when list is empty

  $: allowNonEmptyString('"class" attribute',ClassNames)
  $: allowNonEmptyString('"style" attribute',style)

  $: List = allowedList('"List" attribute', List) || []

  let KeyOf:(Item:any) => string
  $: switch (true) {
    case (Key == null):
      KeyOf = (Item) => String(Item); break
    case ValueIsNonEmptyString(Key):
      KeyOf = (Item) => String(Item[Key as string]); break
    case ValueIsFunction(Key):
      KeyOf = (Item) => String((Key as Function)(Item)); break
    default: throwError(
      'InvalidArgument: the given "Key" attribute is neither ' +
      'a non-empty string nor a function returning such a string'
    )
  }

  $: Placeholder = (
    allowedNonEmptyString('"Placeholder" attribute',Placeholder) || '(empty list)'
  )


</script>

<ul class:List={(ClassNames == null) && (style == null)} class={ClassNames} {style}
  {...$$restProps}
>
  {#if (List.length > 0)}
    {#each List as Item,Index (KeyOf(Item))}
      <li>
        <slot {Item} {Index}>
          {KeyOf(Item)}
        </slot>
      </li>
    {/each}
  {:else}
    <li class="centered">{Placeholder}</li>
  {/if}
</ul>

