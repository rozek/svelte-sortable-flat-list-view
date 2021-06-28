<!----------------------------------------------------------------------------//
//                       Svelte Sortable Flat List View                       //
//----------------------------------------------------------------------------->

<svelte:options accessors={true}/>

<style>
  .List {
    display:inline-block; position:relative;
    margin:0px; padding:0px 0px 4px 0px;
    list-style:none;
  }

  .withoutTextSelection {
    -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none;
    user-select:none;
  }

  .List > li {
    display:block; position:relative;
    border:none; margin:0px; padding:0px;
    list-style:none;
  }

  .List > li:hover { background:royalblue }

  .selectableItem.selected       { background:dodgerblue }
  .selectableItem.selected:hover { background:royalblue }

  .InsertionPoint {
    display:block; position:relative;
    width:100%; height:20px;
    background:transparent;
    border:none; margin:0px; padding:0px;
    list-style:none;
  }

  .AttachmentPoint {
    display:block; position:relative;
    width:100%; height:20px;
    background:transparent;
    border:none; margin:0px; padding:0px;
    list-style:none;
  }

  .Placeholder {
    display:flex; position:absolute;
    left:0px; top:0px; right:0px; height:100%; /* bottom:0px seems to fail */
    flex-flow:column nowrap; justify-content:center; align-items:center;
  }
</style>

<script lang="ts">
  import {
    throwError,
    ValueIsNonEmptyString, ValueIsFunction, ValueIsObject, ValueIsList,
    ValueIsOneOf,
    allowedBoolean, allowedString, allowNonEmptyString, allowedNonEmptyString,
    allowFunction, allowPlainObject, allowedPlainObject,
    allowListSatisfying, allowedListSatisfying,
    ObjectIsNotEmpty, quoted
  } from 'javascript-interface-library'
  import Device from 'svelte-device-info'

  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  import newUniqueId from 'locally-unique-id-generator'
  let privateKey:string = newUniqueId()

/**** common Attributes ****/

  let ClassNames:string; export { ClassNames as class } // used to ctrl. styling
  export let style:string                                                // dto.

  $: allowNonEmptyString('"class" attribute',ClassNames)
  $: allowNonEmptyString('"style" attribute',style)

  export let List:{}[]                            // the (flat) list to be shown
  export let Key:string|Function|undefined   // the value to be used as list key
  export let Instruction:string|undefined        // is shown in insertion points
  export let Placeholder:string|undefined         // is shown when list is empty

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

  $: Instruction = (
    allowedNonEmptyString('"Instruction" attribute',Instruction) || 'drop here'
  )

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

//----------------------------------------------------------------------------//
//                         Selection and Deselection                          //
//----------------------------------------------------------------------------//

  let SelectionSet = new WeakMap()    // automatically "updates" on list changes

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
    SelectionRangeBoundaryB = undefined
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

    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined
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

    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined
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

    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined
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
            SelectionRangeBoundaryB = undefined
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

/**** handleClick ****/

  function handleClick (Event:MouseEvent, Item:{}):void {
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

//----------------------------------------------------------------------------//
//                           Drag-and-Drop Handling                           //
//----------------------------------------------------------------------------//

  import type { Position, DropOperation, DataOfferSet, TypeAcceptanceSet } from 'svelte-drag-and-drop-actions'
  import      { DropOperations, asDroppable, asDropZone } from 'svelte-drag-and-drop-actions'

  let isDragging:boolean = false
  let InsertionPoint:any = undefined

/**** Attributes for Sorting ****/

  export let sortable:boolean = false  // does this list view support "sorting"?
  export let onSortRequest:undefined|((          // opt. callback before sorting
    x:number,y:number, DroppableExtras:any, DropZoneExtras:any
  ) => boolean|undefined)
  export let onSort:undefined|          // opt. callback performing act. sorting
    ((beforeItem:any|undefined, ...ItemList:{}[]) => void)

  $: sortable = allowedBoolean('"sortable" attribute',sortable) || false

  $: allowFunction('"onSortRequest" callback',onSortRequest)
  $: allowFunction       ('"onSort" callback',onSort)

/**** Attributes for Drag-and-Drop ****/

  export let Operations:string|undefined
  export let DataToOffer:DataOfferSet|undefined
  export let TypesToAccept:TypeAcceptanceSet|undefined

  export let onOuterDropRequest:undefined|((// opt. callback before outside drop
    x:number,y:number,
    Operation:DropOperation, offeredTypeList:string[],
    DroppableExtras:any, DropZoneExtras:any
  ) => boolean|undefined)
  export let onDroppedOutside:undefined|((   // opt. callback after outside drop
    x:number,y:number,
    Operation:DropOperation, TypeTransferred:string, DataTransferred:any,
    DropZoneExtras:any, DroppableExtras:any
  ) => void)
  export let onDropFromOutside:undefined|((//opt. callback for drop from outside
    x:number,y:number,
    Operation:DropOperation, DataOffered:DataOfferSet,
    DroppableExtras:any, DropZoneExtras:any
  ) => string)

  let wantedOperations:string|undefined
  let DataOffered:DataOfferSet|undefined
  let TypesAccepted:TypeAcceptanceSet|undefined

  $: wantedOperations = parsedOperations('list of allowed operations',Operations)

  $: allowPlainObject  ('"DataToOffer" attribute',DataToOffer)
  $: allowPlainObject('"TypesToAccept" attribute',TypesToAccept)

  $: allowFunction('"onOuterDropRequest" callback',onOuterDropRequest)
  $: allowFunction  ('"onDroppedOutside" callback',onDroppedOutside)
  $: allowFunction ('"onDropFromOutside" callback',onDropFromOutside)

  $: if (! isDragging) {                 // do not update while already dragging
    DataOffered = Object.assign({}, DataToOffer)
// @ts-ignore "DataOffered" is definitely not undefined
    if (sortable) { DataOffered[privateKey] = '' }
  }

  $: if (! isDragging) {                 // do not update while already dragging
    TypesAccepted = {}
      for (let Type in TypesToAccept) {
        if (TypesToAccept.hasOwnProperty(Type)) {
// @ts-ignore "TypesAccepted" is definitely not undefined
          TypesAccepted[Type] = parsedOperations(
            'list of accepted operations for type ' + quoted(Type),
            TypesToAccept[Type]
          )
        }
      }
// @ts-ignore "TypesAccepted" is definitely not undefined
    if (sortable) { TypesAccepted[privateKey] = 'copy' }
  }    // 'copy' because of the better visual feedback from native drag-and-drop

/**** parsedOperations ****/

  function parsedOperations (
    Description:string, Argument:any, Default:string='copy move link'
  ):string {
    let Operations = allowedString(Description,Argument) || Default

    switch (Operations.trim()) {
      case 'all':  return 'copy move link'
      case 'none': return ''
    }

    let OperationList = Operations.trim().replace(/\s+/g,' ').split(' ')
      allowListSatisfying(
        Description,OperationList,
        (Operation:string) => ValueIsOneOf(Operation,DropOperations)
      )
    return OperationList.reduce(
      (Result:string, Operation:string) => (
        Result.indexOf(Operation) < 0 ? Result + Operation + ' ': Result
      ),' '
    )
  }

/**** prepare for drag-and-drop ****/

  function hasNonPrivateTypes (TypeSet:any):boolean {
    for (let Type in Set) {
      if (Set.hasOwnProperty(Type) && (Type !== privateKey)) {
        return true
      }
    }
    return false
  }

  let shrinkable:boolean = false
  let extendable:boolean = false
  $: if (! isDragging) {                 // do not update while already dragging
    shrinkable = hasNonPrivateTypes(DataOffered)
    extendable = hasNonPrivateTypes(TypesAccepted)
  }

/**** onDragStart ****/

  function onDragStart (DraggableExtras:any):Position {
  }

/**** onDragEnd ****/

  function onDragEnd (
    x:number,y:number, dx:number,dy:number, DraggableExtras:any
  ):void {
  }

/**** onDropped ****/

  function onDropped (
    x:number,y:number, Operation:DropOperation,
    TypeTransferred:string, DataTransferred:any,
    DropZoneExtras:any, DroppableExtras:any
  ):void {
  }

/**** onDroppableEnter ****/

  function onDroppableEnter (
    x:number,y:number, Operation:DropOperation,
    offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:any
  ):boolean {
  }

/**** onDroppableMove ****/

  function onDroppableMove (
    x:number,y:number, Operation:DropOperation,
    offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:any
  ):boolean {
  }

/**** onDroppableLeave ****/

  function onDroppableLeave (DroppableExtras:any, DropZoneExtras:any):void {
  }

/**** onDrop ****/

  function onDrop (
    x:number,y:number, Operation:DropOperation,
    DataOffered:any, DroppableExtras:any, DropZoneExtras:any
  ):string {
  }

/**** onAppendageDroppableEnter ****/

  function onAppendageDroppableEnter (
    x:number,y:number, Operation:DropOperation,
    offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:any
  ):boolean {
  }

/**** onAppendageDroppableMove ****/

  function onAppendageDroppableMove (
    x:number,y:number, Operation:DropOperation,
    offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:any
  ):boolean {
  }

/**** onAppendageDroppableLeave ****/

  function onAppendageDroppableLeave (DroppableExtras:any, DropZoneExtras:any):void {
  }

/**** onAppendageDrop ****/

  function onAppendageDrop (
    x:number,y:number, Operation:DropOperation,
    DataOffered:any, DroppableExtras:any, DropZoneExtras:any
  ):string {
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
      {#if sortable || extendable || shrinkable}
        {#if Item === InsertionPoint}
          <li
            class:InsertionPoint={(ClassNames == null) && (style == null)}
            use:asDropZone={{
              Extras:{ List, Item },
              onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave
            }}
          >{Instruction}</li>
        {/if}

        <li
          class:selectableItem={(ClassNames == null) && (style == null)}
          class:selected={isSelected(Item)}
          on:click={(Event) => handleClick(Event,Item)}
          use:asDroppable={{
            Extras:{ List, Item },
            onDragStart, onDragEnd, onDropped
          }}
          use:asDropZone={{
            Extras:{ List, Item },
            onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave
          }}
        >
          <slot {Item} {Index}> {KeyOf(Item)} </slot>
        </li>
      {:else}
        <li
          class:selectableItem={(ClassNames == null) && (style == null)}
          class:selected={isSelected(Item)}
          on:click={(Event) => handleClick(Event,Item)}
        >
          <slot {Item} {Index}> {KeyOf(Item)} </slot>
        </li>
      {/if}
    {/each}

    {#if sortable || extendable}
      <li class="AttachmentPoint" use:asDropZone={{
        Extras:{ List, Item:undefined },
        onDroppableEnter:onAppendageDroppableEnter,
        onDroppableMove:onAppendageDroppableMove,
        onDroppableLeave:onAppendageDroppableLeave,
        onDrop:onAppendageDrop
      }}>{Instruction}</li>
    {/if}
  {:else}
    <li class="Placeholder">{Placeholder}</li>
  {/if}
</ul>

