<!----------------------------------------------------------------------------//
//                       Svelte Sortable Flat List View                       //
//----------------------------------------------------------------------------->

<svelte:options accessors={true}/>

<style>
  .defaultListView {
    display:inline-flex; flex-flow:column nowrap; position:relative;
    justify-content:flex-start; align-items:stretch;
    margin:0px; padding:0px;
    list-style:none;
  }

  .withoutTextSelection {
    -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none;
    user-select:none;
  }

  .defaultListView > :global(.ListItemView) {
    display:block; position:relative; flex:0 0 auto;
    height:30px; line-height:30px;
    border:solid 1px transparent;
    margin:0px 2px 0px 2px; padding:0px 4px 0px 4px;
    list-style:none;
  }

  .defaultListView > :global(.ListItemView:hover:not(.dragged))    { border:solid 1px }
  .defaultListView > :global(.ListItemView.selected:not(.dragged)) { background:dodgerblue }

  .defaultListView > :global(.ListItemView.dragged)               { opacity:0.3 }
  .defaultListView > :global(.ListItemView.hovered:not(.dragged)) { border-top:solid 10px transparent }

  .defaultListView > :global(.AttachmentRegion) {
    display:block; position:relative; flex:1 1 auto;
    min-height:20px;
    background:transparent;
    border:solid 1px transparent; margin:0px 2px 2px 2px; padding:0px;
    list-style:none;
  }
  .defaultListView > :global(.AttachmentRegion.hovered) { border:solid 1px }

  .defaultListView > :global(.Placeholder) {
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
    allowedBoolean, allowOrdinal, allowedString, allowNonEmptyString,
    allowFunction, allowPlainObject, allowListSatisfying, allowedListSatisfying,
    ValuesDiffer, quoted
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
  export let SelectionLimit:number|undefined    // max. number of selected items
  export let InsertionRegion:string|undefined    // is shown in insertion region
  export let AttachmentRegion:string|undefined  // is shown in attachment region
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

  $: allowOrdinal('selection limit',SelectionLimit)

  $: allowNonEmptyString ('"InsertionRegion" attribute',InsertionRegion)
  $: allowNonEmptyString('"AttachmentRegion" attribute',AttachmentRegion)
  $: allowNonEmptyString     ('"Placeholder" attribute',Placeholder)

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
    let curSelectionCount = SelectionCount()
    ItemList.forEach((Item) => {
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        if (! SelectionSet.has(Item)) {
          if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
            SelectionSet.set(Item,true); curSelectionCount++
            dispatch('selected-item',Item)
          }
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
    if (ValuesDiffer(selectedItems(),ItemList)) {              // not perfect...
      deselectAll()
      select(...ItemList)
//    triggerRedraw()                                     // already done before
    }
  }

/**** selectAll ****/

  export function selectAll ():void {
    let curSelectionCount = SelectionCount()
    List.forEach((Item) => {
      if (! SelectionSet.has(Item)) {
        if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
          SelectionSet.set(Item,true); curSelectionCount++
          dispatch('selected-item',Item)
        }
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

    let curSelectionCount = SelectionCount()
    for (let i = firstIndex; i <= lastIndex; i++) {
      if (! SelectionSet.has(List[i])) {
        if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
          SelectionSet.set(List[i],true)
          dispatch('selected-item',List[i])
        }
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
        dispatch('deselected-item',List[i])
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
          dispatch('deselected-item',Item)
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
        dispatch('deselected-item',Item)
      }
    })

    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined
    triggerRedraw()
  }

/**** toggleSelectionOf - no check for multiply mentioned items ****/

  export function toggleSelectionOf (...ItemList:{}[]):void {
    SelectionRangeBoundaryA = undefined

    let ItemsToBeSelected:{}[] = []
    ItemList.forEach((Item) => {  // deselect first (because of potential limit)
      let Key = KeyOf(Item)
      if (Key in ItemSet) {
        if (SelectionSet.has(Item)) {
          SelectionSet.delete(Item)
          dispatch('deselected-item',Item)
        } else {
          ItemsToBeSelected.push(Item)
        }
      } else {
        throwError(
          'InvalidArgument: one or multiple of the given items to select ' +
          'or deselect are not part of the given "List"'
        )
      }
    })

    let curSelectionCount = SelectionCount()
    if (SelectionLimit != null) {
      let maxToBeSelected = SelectionLimit-curSelectionCount
      if (maxToBeSelected < ItemsToBeSelected.length) {
        ItemsToBeSelected.length = maxToBeSelected
      }
    }

    ItemsToBeSelected.forEach((Item) => { // now select as many items as allowed
      SelectionSet.set(Item,true)
      dispatch('selected-item',Item)

      if (ItemList.length === 1) {
        SelectionRangeBoundaryA = Item
        SelectionRangeBoundaryB = undefined
      }
    })

    triggerRedraw()
  }

/**** selectedItems ****/

  export function selectedItems ():{}[] {
    let Result:{}[] = List.filter((Item) => SelectionSet.has(Item))
    return Result
  }

/**** SelectionCount ****/

  export function SelectionCount ():number {
    return List.reduce(
      (Count:number,Item) => Count + (SelectionSet.has(Item) ? 1 : 0),0
    )
  }

  $: if ((SelectionLimit != null) && (SelectionCount() > SelectionLimit)) {
    let Count = 0
    List.forEach((Item) => {
      if (SelectionSet.has(Item)) {
        Count++
        if (Count > (SelectionLimit as number)) { deselect(Item) }
      }
    })
  } // decreasing the selection limit with an active selection is very bad style

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

  let isDragging:boolean    = false
  let draggedItemList:any[] = []

  let InsertionPoint:any = undefined

/**** Attributes for Sorting ****/

  export let sortable:boolean = false  // does this list view support "sorting"?
  export let onlyFrom:string|undefined
  export let neverFrom:string|undefined

  export let onSortRequest:undefined|((          // opt. callback before sorting
    x:number,y:number, DroppableExtras:any, DropZoneExtras:any
  ) => boolean)
  export let onSort:undefined|          // opt. callback performing act. sorting
    ((beforeItem:any|undefined, ...ItemList:{}[]) => void)

  $: sortable = allowedBoolean('"sortable" attribute',sortable) || false

  $: allowNonEmptyString ('"onlyFrom" CSS selector list',onlyFrom)
  $: allowNonEmptyString('"neverFrom" CSS selector list',neverFrom)

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
  ) => boolean)
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
    if (sortable) { TypesAccepted[privateKey] = 'copy move' }
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

/**** ad-hoc Dummy Creation ****/

  function dynamicDummy (
    DroppableExtras:any, Element:HTMLElement|SVGElement
  ):HTMLElement|SVGElement {
    let auxiliaryElement = Element.cloneNode(true) as HTMLElement
      auxiliaryElement.style.display  = 'block'
      auxiliaryElement.style.position = 'absolute'
      auxiliaryElement.style.left     = (document.body.scrollWidth + 100)+'px'
      auxiliaryElement.style.width    = Element.clientWidth+'px'  // not perfect
      auxiliaryElement.style.height   = Element.clientHeight+'px'        // dto.

      if (draggedItemList.length > 1) {            // called after "onDragStart"
        let Badge = document.createElement('div')
          Badge.setAttribute('style',
            'display:block; position:absolute; ' +
            'top:-10px; right:-10px; width:20px; height:20px; ' +
            'background:red; color:white; ' +
            'border:none; border-radius:10px; margin:0px; padding:0px 4px 0px 4px; ' +
            'line-height:20px; text-align:center'
          )
          Badge.innerText = '+' + (draggedItemList.length-1)
        auxiliaryElement.appendChild(Badge)
      }

      document.body.appendChild(auxiliaryElement)

      setTimeout(() => {       // remove element after browser took its snapshot
        document.body.removeChild(auxiliaryElement)
      },0)
    return auxiliaryElement as HTMLElement
  }

/**** onDragStart ****/

  function onDragStart (DroppableExtras:any):Position {
    isDragging = true

    if (! isSelected(DroppableExtras.Item)) {
      selectOnly(DroppableExtras.Item)
    }

    draggedItemList = selectedItems()
    DroppableExtras.ItemList = draggedItemList

    return { x:0,y:0 }
  }

/**** onDragEnd ****/

  function onDragEnd (
    x:number,y:number, dx:number,dy:number, DraggableExtras:any
  ):void {
    isDragging = false
    draggedItemList.length = 0
  }

/**** onDropped ****/

  function onDropped (
    x:number,y:number, Operation:DropOperation,
    TypeTransferred:string, DataTransferred:any,
    DropZoneExtras:any, DroppableExtras:any
  ):void {
    let droppedHere = (DropZoneExtras != null) && (DropZoneExtras.List === List)
    if (! droppedHere) {
      if (onDroppedOutside != null) {
        try {
          onDroppedOutside(
            x,y, Operation, TypeTransferred,DataTransferred,
            DropZoneExtras,DroppableExtras
          )
        } catch (Signal) {
          console.error(
            'RuntimeError: callback "onDroppedOutside" failed', Signal
          )
        }           // no event to be dispatched (there is already the callback)

        triggerRedraw()                           // just to be on the safe side
      } else {
        let DroppableSet = SetOfItemsIn(DroppableExtras.ItemList)
        for (let i = List.length-1; i >= 0; i--) {
          let Key = KeyOf(List[i])
          if (Key in DroppableSet) { List.splice(i,1) }
        }

        dispatch('removed-items',DroppableExtras.ItemList.slice())
        triggerRedraw()
      }
    }
  }

/**** onDroppableEnter ****/

  function onDroppableEnter (
    x:number,y:number, Operation:DropOperation,
    offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:any
  ):boolean {
    let draggedItem = DroppableExtras && DroppableExtras.Item
    if (
      (draggedItemList.indexOf(draggedItem) >= 0) &&       // not a foreign item
      (draggedItemList.indexOf(DropZoneExtras && DropZoneExtras.Item) >= 0)
    ) {               // don't allow dragged items to be dropped onto themselves
      InsertionPoint = undefined
      triggerRedraw()
      return false
    }

    let mayBeInsertedHere = true     // because dnd-action already checked a bit
      if (List === (DroppableExtras && DroppableExtras.List)) {  // own elements
        if (sortable) {
          if (onSortRequest != null) {
            try {
              mayBeInsertedHere = onSortRequest(
                x,y, DropZoneExtras,DroppableExtras
              )
            } catch (Signal) {
              mayBeInsertedHere = false
              console.error(
                'RuntimeError: callback "onSortRequest" failed', Signal
              )
            }
          }
        } else {    // not sortable? then own list items may not be dropped here
          mayBeInsertedHere = false
        }
      } else {                       // foreign elements want to be dropped here
        if (onOuterDropRequest != null) {
          try {
            mayBeInsertedHere = onOuterDropRequest(
              x,y, Operation,offeredTypeList, DropZoneExtras,DroppableExtras
            )
          } catch (Signal) {
            mayBeInsertedHere = false
            console.error(
              'RuntimeError: callback "onOuterDropRequest" failed', Signal
            )
          }
        }
      }
    InsertionPoint = (mayBeInsertedHere ? DropZoneExtras.Item : undefined)
    triggerRedraw()

    return mayBeInsertedHere && (Operation !== 'link')
  }

/**** onDroppableMove ****/

  const onDroppableMove = onDroppableEnter

/**** onDroppableLeave ****/

  function onDroppableLeave (DroppableExtras:any, DropZoneExtras:any):void {
    InsertionPoint = undefined
//  triggerRedraw()
  }

/**** onDrop ****/

  function onDrop (
    x:number,y:number, Operation:DropOperation,
    DataOffered:any, DroppableExtras:any, DropZoneExtras:any
  ):string {
    InsertionPoint = undefined

    let draggedItem = DroppableExtras && DroppableExtras.Item
    if (
      (draggedItemList.indexOf(draggedItem) >= 0) &&       // not a foreign item
      (draggedItemList.indexOf(DropZoneExtras && DropZoneExtras.Item) >= 0)
    ) {               // don't allow dragged items to be dropped onto themselves
      return 'none'
    }

    if (List === (DroppableExtras && DroppableExtras.List)) {    // own elements
      if (sortable) {
        if (onSort == null) {
          let ItemsToBeShifted = DroppableExtras.ItemList

          let DroppableSet = SetOfItemsIn(ItemsToBeShifted)
          for (let i = List.length-1; i >= 0; i--) {
            let Key = KeyOf(List[i])
            if (Key in DroppableSet) { List.splice(i,1) }
          }

          let InsertionIndex = List.indexOf(DropZoneExtras && DropZoneExtras.Item)
          if (InsertionIndex < 0) { InsertionIndex = List.length } // for append

// @ts-ignore argument list of "apply" is known to be correct
          List.splice.apply(List, [InsertionIndex,0].concat(ItemsToBeShifted))

          dispatch('sorted-items',[ItemsToBeShifted,InsertionIndex])
          triggerRedraw()
        } else {
          try {
            onSort(DropZoneExtras.Item, DroppableExtras.ItemList)
          } catch (Signal) {
            console.error('RuntimeError: callback "onSort" failed', Signal)
          }         // no event to be dispatched (there is already the callback)

          triggerRedraw()                         // just to be on the safe side
        }
        return Operation   // should be 'move', but 'copy' gives better feedback
      } else {
        return 'none'
      }
    } else {                         // foreign elements want to be dropped here
      if (onDropFromOutside == null) {
        let ItemsToBeInserted = (DroppableExtras && DroppableExtras.ItemList)
        if (! ValueIsList(ItemsToBeInserted)) { return 'none' }

        let InsertionIndex = List.indexOf(DropZoneExtras && DropZoneExtras.Item)
        if (InsertionIndex < 0) { InsertionIndex = List.length } // for "append"

// @ts-ignore argument list of "apply" is known to be correct
        List.splice.apply(List, [InsertionIndex,0].concat(ItemsToBeInserted))

        dispatch('inserted-items',[ItemsToBeInserted,InsertionIndex])
        triggerRedraw()

        return Operation
      } else {
        let actualOperation:string = 'none'
          try {
            actualOperation = onDropFromOutside(
              x,y, Operation,DataOffered, DroppableExtras,DropZoneExtras
            )
          } catch (Signal) {
            console.error('RuntimeError: callback "onSort" failed', Signal)
          }         // no event to be dispatched (there is already the callback)

          triggerRedraw()                         // just to be on the safe side
        return actualOperation || 'none'
      }
    }
  }

/**** SetOfItemsIn ****/

  function SetOfItemsIn (ItemList:any[]):{} {
    let ItemSet = Object.create(null)
      ItemList.forEach((Item) => {
        let Key:string = KeyOf(Item)
        ItemSet[Key] = Item
      })
    return ItemSet
  }



/**** triggerRedraw ****/

  function triggerRedraw ():void { List = List }
</script>

<ul
  class:defaultListView={ClassNames == null}
  class:withoutTextSelection={true}
  class={ClassNames} {style}
  {...$$restProps}
>
  {#if (List.length > 0)}
    {#if sortable || extendable || shrinkable}
      {#each List as Item,Index (KeyOf(Item))}
        <li
          class:ListItemView={true}
          class:dragged={draggedItemList.indexOf(Item) >= 0}
          class:selected={isSelected(Item)}
          on:click={(Event) => handleClick(Event,Item)}
          use:asDroppable={{
            onlyFrom, neverFrom, Dummy:dynamicDummy,
            Extras:{ List, Item }, DataToOffer:DataOffered,
            onDragStart, onDragEnd, onDropped
          }}
          use:asDropZone={{
            Extras:{ List, Item, ItemList:undefined }, TypesToAccept:TypesAccepted,
            onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave
          }}
        >
          <slot {Item} {Index}> {KeyOf(Item)} </slot>
        </li>
      {/each}

      {#if sortable || extendable}
        <li
          class:AttachmentRegion={true}
          use:asDropZone={{
            Extras:{ List, Item:undefined, ItemList:undefined }, TypesToAccept:TypesAccepted,
            onDroppableEnter, onDroppableMove, onDrop
          }}
        >{@html AttachmentRegion || ''}</li>
      {/if}
    {:else}
      {#each List as Item,Index (KeyOf(Item))}
        <li
          class:ListItemView={true}
          class:selected={isSelected(Item)}
          on:click={(Event) => handleClick(Event,Item)}
        >
          <slot {Item} {Index}> {KeyOf(Item)} </slot>
        </li>
      {/each}
    {/if}
  {:else}
    <li
      class:Placeholder={true}
    >{@html Placeholder || '(empty list)'}</li>
  {/if}
</ul>

