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

  export let List:{}[]                            // the (flat) list to be shown
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
        SelectionSet.set(Item,true)
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
    List.forEach((Item) => SelectionSet.set(Item,true))

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
      SelectionSet.set(List[i],true)
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
      SelectionSet.delete(List[i])
    }
  }

/**** deselect ****/

  export function deselect (...ItemList:{}[]):void {
    ItemList.forEach((Item) => {
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        SelectionSet.delete(Item)
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
    SelectionSet = new WeakMap()
    triggerRedraw()
  }

/**** selectedItems ****/

  export function selectedItems ():{}[] {
    let Result:{}[] = List.filter((Item) => SelectionSet.has(Item))
    return Result
  }



/**** triggerRedraw ****/

  function triggerRedraw ():void { ItemSet = ItemSet }
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

