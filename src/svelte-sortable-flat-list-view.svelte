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

  .withoutTextSelection {
    -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none;
    user-select:none;
  }

  .List > li {
    display:block; position:relative;
    margin:0px; padding:0px;
    list-style:none;
  }

  .selectableItem.selected {
    background:dodgerblue;
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
    ValueIsNonEmptyString, ValueIsFunction, ValueIsObject, ValueIsList,
    allowNonEmptyString, allowedNonEmptyString, allowedListSatisfying
  } from 'javascript-interface-library'
  import Device from 'svelte-device-info'

  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  let ClassNames:string; export { ClassNames as class } // used to ctrl. styling
  export let style:string                                                // dto.

  export let List:{}[]                            // the (flat) list to be shown
  export let Key:string|Function|undefined   // the value to be used as list key
  export let Placeholder:string|undefined         // is shown when list is empty

  $: allowNonEmptyString('"class" attribute',ClassNames)
  $: allowNonEmptyString('"style" attribute',style)

  $: List = allowedListSatisfying('"List" attribute', List, ValueIsObject) || []

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

/**** Key Validation and quick Lookup ****/

  let ItemSet:{ [Key:string]:{} }

  function updateItemSet (...ArgumentsAreForReactivityOnly:any[]):void {
    ItemSet = Object.create(null)

    List.forEach((Item) => {
      let Key:string = KeyOf(Item)
      if (Key in ItemSet) {
        if (ItemSet[Key] === Item) {
          throwError(
            'InvalidArgument: the given "List" contains the same item ' +
            'multiple times'
          )
        } else {
          throwError(
            'InvalidArgument: the given "Key" does not produce unique keys ' +
            'for every "List" item'
          )
        }
      } else {
        ItemSet[Key] = Item
      }
    })
  }

  $: updateItemSet(List,Key)

  let SelectionSet = new WeakMap()

/**** select ****/

  export function select (...ItemList:{}[]):void {
    ItemList.forEach((Item) => {
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        if (! SelectionSet.has(Item)) {
          SelectionSet.set(Item,true)
          dispatch('selected',Item)
        }
      } else {
        throwError(
          'InvalidArgument: one or multiple of the given items to select ' +
          'are not part of the given "List"'
        )
      }
    })

    SelectionRangeBoundaryA = (ItemList.length === 1 ? ItemList[0] : undefined)
    triggerRedraw()
  }

/**** selectOnly ****/

  export function selectOnly (...ItemList:{}[]):void {
    deselectAll()
    select(...ItemList)
//  triggerRedraw()                                       // already done before
  }

/**** selectAll ****/

  export function selectAll ():void {
    List.forEach((Item) => {
      if (! SelectionSet.has(Item)) {
        SelectionSet.set(Item,true)
        dispatch('selected',Item)
      }
    })

    SelectionRangeBoundaryA = undefined
    triggerRedraw()
  }

  let SelectionRangeBoundaryA:{} | undefined
  let SelectionRangeBoundaryB:{} | undefined

/**** selectRange ****/

  export function selectRange (RangeBoundary:{}):void {
    if (SelectionRangeBoundaryA == null) {
      select(RangeBoundary)             // will also set SelectionRangeBoundaryA
      return
    }

    if (SelectionRangeBoundaryA === RangeBoundary) { return }

    if (SelectionRangeBoundaryB != null) {
      deselectRange(SelectionRangeBoundaryB)
    }

    let IndexA = List.indexOf(SelectionRangeBoundaryA)
    let IndexB = List.indexOf(RangeBoundary)

    let firstIndex = Math.min(IndexA,IndexB)
    let lastIndex  = Math.max(IndexA,IndexB)

    for (let i = firstIndex; i <= lastIndex; i++) {
      if (! SelectionSet.has(List[i])) {
        SelectionSet.set(List[i],true)
        dispatch('selected',List[i])
      }
    }

    SelectionRangeBoundaryB = RangeBoundary
    triggerRedraw()
  }

/**** deselectRange (internal only) ****/

  function deselectRange (RangeBoundary:{}):void {
    let IndexA = List.indexOf(SelectionRangeBoundaryA as {})
    let IndexB = List.indexOf(RangeBoundary)

    let firstIndex = Math.min(IndexA,IndexB)
    let lastIndex  = Math.max(IndexA,IndexB)

    for (let i = firstIndex; i <= lastIndex; i++) {
      if (SelectionSet.has(List[i])) {
        SelectionSet.delete(List[i])
        dispatch('deselected',List[i])
      }
    }
  }

/**** deselect ****/

  export function deselect (...ItemList:{}[]):void {
    ItemList.forEach((Item) => {
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        if (SelectionSet.has(Item)) {
          SelectionSet.delete(Item)
          dispatch('deselected',Item)
        }
      } else {
        throwError(
          'InvalidArgument: one or multiple of the given items to deselect ' +
          'are not part of the given "List"'
        )
      }
    })

    SelectionRangeBoundaryA = undefined
    triggerRedraw()
  }

/**** deselectAll ****/

  export function deselectAll ():void {
    List.forEach((Item) => {
      if (SelectionSet.has(Item)) {
        SelectionSet.delete(Item)
        dispatch('deselected',Item)
      }
    })

    SelectionRangeBoundaryA = undefined
    triggerRedraw()
  }

/**** toggleSelectionOf - no check for multiply mentioned items ****/

  export function toggleSelectionOf (...ItemList:{}[]):void {
    SelectionRangeBoundaryA = undefined

    ItemList.forEach((Item) => {
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        if (SelectionSet.has(Item)) {
          SelectionSet.delete(Item)
          dispatch('deselected',Item)
        } else {
          SelectionSet.set(Item,true)
          dispatch('selected',Item)

          if (ItemList.length === 1) {
            SelectionRangeBoundaryA = Item
          }
        }
      } else {
        throwError(
          'InvalidArgument: one or multiple of the given items to select ' +
          'or deselect are not part of the given "List"'
        )
      }
    })

    triggerRedraw()
  }

/**** selectedItems ****/

  export function selectedItems ():{}[] {
    let Result:{}[] = List.filter((Item) => SelectionSet.has(Item))
    return Result
  }

/**** isSelected ****/

  export function isSelected (Item:{}):boolean {
    return SelectionSet.has(Item)
  }

/**** handleOnClick ****/

  function handleOnClick (Event:MouseEvent, Item:{}):void {
    switch (true) {
      case (Event.buttons === 0) && (Event.button  !== 0): return  // workaround
      case (Event.buttons !== 0) && (Event.buttons !== 1): return  // ...for bug

      case (Device.PointingAccuracy === 'coarse'):
      case Event.ctrlKey:
      case Event.metaKey:  toggleSelectionOf(Item); break
      case Event.shiftKey: selectRange(Item);       break
      default:             selectOnly(Item);        break
    }

    Event.preventDefault()
    Event.stopPropagation()
  }



/**** triggerRedraw ****/

  function triggerRedraw ():void { List = List }
</script>

<ul
  class:List={(ClassNames == null) && (style == null)}
  class:withoutTextSelection={true}
  class={ClassNames} {style}
  {...$$restProps}
>
  {#if (List.length > 0)}
    {#each List as Item,Index (KeyOf(Item))}
      <li
        class:selectableItem={(ClassNames == null) && (style == null)}
        class:selected={isSelected(Item)}
        on:click={(Event) => handleOnClick(Event,Item)}
      >
        <slot {Item} {Index}>
          {KeyOf(Item)}
        </slot>
      </li>
    {/each}
  {:else}
    <li class="centered">{Placeholder}</li>
  {/if}
</ul>

