<!------------------------------------------------------------------------------
--                       Svelte Sortable Flat List View                       --
------------------------------------------------------------------------------->

<svelte:options accessors={true}/>

<ul
  bind:this={ListViewElement}
  class:defaultListView={ClassNames == null}
  class:withoutTextSelection={true}
  class={ClassNames} {style}
  {...$$restProps}
>
  {#if (List.length > 0)}
    {#if sortable || extendable || shrinkable}
      {#each List as Item,Index (KeyOf(Item,Index))}
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
            Extras:{ List, Item }, TypesToAccept:TypesAccepted,
            onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave,
            HoldDelay, onDroppableHold,
            Pannable:ListViewElement, PanSensorWidth,PanSensorHeight, PanSpeed
          }}
          animate:flip
          transition:scale={{ duration:withTransitions ? 300 : 0 }}
            on:introstart={TransitionStarted} on:introend={TransitionEnded}
            on:outrostart={TransitionStarted} on:outroend={TransitionEnded}
        >
          <slot {Item} {Index}> {KeyOf(Item,Index)} </slot>
        </li>
      {/each}

      {#if sortable || extendable}
        <li
          class:AttachmentRegion={true}
          use:asDropZone={{
            Extras:{ List, Item:undefined }, TypesToAccept:TypesAccepted,
            onDroppableEnter, onDroppableMove, onDrop,
            HoldDelay, onDroppableHold
          }}
        >{@html AttachmentRegion || ''}</li>
      {/if}
    {:else}
      {#each List as Item,Index (KeyOf(Item,Index))}
        <li
          class:ListItemView={true}
          class:selected={isSelected(Item)}
          on:click={(Event) => handleClick(Event,Item)}
          transition:scale={{ duration:withTransitions ? 300 : 0 }}
            on:introstart={TransitionStarted} on:introend={TransitionEnded}
            on:outrostart={TransitionStarted} on:outroend={TransitionEnded}
        >
          <slot {Item} {Index}> {KeyOf(Item,Index)} </slot>
        </li>
      {/each}
    {/if}
  {:else}
    {#if extendable}
      <li
        class:Placeholder={true}
        use:asDropZone={{
          Extras:{ List, Item:undefined }, TypesToAccept:TypesAccepted,
          onDroppableEnter, onDroppableMove, onDrop
        }}
      >{@html Placeholder || '(empty list)'}</li>
    {:else}
      <li class:Placeholder={true}>{@html Placeholder || '(empty list)'}</li>
    {/if}
  {/if}
</ul>


<script context=module>
import newUniqueId from 'locally-unique-id-generator';
import Device from 'svelte-device-info';
;
import { DropOperations, asDroppable, asDropZone } from 'svelte-drag-and-drop-actions';
import { createEventDispatcher } from 'svelte';
import { flip } from 'svelte/animate';
</script>
<script>
import { // see https://github.com/sveltejs/svelte/issues/5954
throwError, ValueIsNonEmptyString, ValueIsFunction, ValueIsObject, ValueIsList, ValueIsOneOf, allowBoolean, allowedBoolean, allowIntegerInRange, allowOrdinal, allowedString, allowNonEmptyString, allowFunction, allowPlainObject, allowListSatisfying, ValuesDiffer, quoted } from 'javascript-interface-library';
let privateKey = newUniqueId();
const dispatch = createEventDispatcher();
let ListViewElement; // will refer to the list view's DOM element
/**** common Attributes ****/
let ClassNames = undefined;
export { ClassNames as class }; // used to...
export let style = undefined; // ...control styling
$: allowNonEmptyString('"class" attribute', ClassNames);
$: allowNonEmptyString('"style" attribute', style);
export let List;
export let Key = undefined;
export let AttachmentRegion = undefined;
export let Placeholder = undefined;
export let withTransitions = true;
$: {
    allowListSatisfying('"List" attribute', List, ValueIsObject);
    if (List == null) {
        List = [];
    }
}
let KeyOf;
$: switch (true) {
    case (Key == null):
        KeyOf = (Item) => String(Item);
        break;
    case ValueIsNonEmptyString(Key):
        KeyOf = (Item) => String(Item[Key]);
        break;
    case ValueIsFunction(Key):
        KeyOf = (Item, Index) => String(Key(Item, Index));
        break;
    default: throwError('InvalidArgument: the given "Key" attribute is neither ' +
        'a non-empty string nor a function returning such a string');
}
$: allowNonEmptyString('"AttachmentRegion" attribute', AttachmentRegion);
$: allowNonEmptyString('"Placeholder" attribute', Placeholder);
$: {
    allowBoolean('"withTransitions" attribute', withTransitions);
    if (withTransitions == null) {
        withTransitions = true;
    }
}
/**** Key Validation and quick Lookup ****/
let ItemSet;
function updateItemSet(...ArgumentsAreForReactivityOnly) {
    ItemSet = Object.create(null);
    List.forEach((Item) => {
        let Key = KeyOf(Item);
        if (Key in ItemSet) {
            if (ItemSet[Key] === Item) {
                throwError('InvalidArgument: the given "List" contains the same item ' +
                    'multiple times');
            }
            else {
                throwError('InvalidArgument: the given "Key" does not produce unique keys ' +
                    'for every "List" item');
            }
        }
        else {
            ItemSet[Key] = Item;
        }
    });
    if (ListViewElement != null) { // i.e., after component was initialized
        SelectionList = selectedItems();
    }
}
$: updateItemSet(List, Key);
//----------------------------------------------------------------------------//
//                         Selection and Deselection                          //
//----------------------------------------------------------------------------//
let SelectionSet = new WeakMap(); // automatically "updates" on list changes
/**** Selection Attributes ****/
export let SelectionLimit = undefined;
export let SelectionList = [];
$: allowOrdinal('selection limit', SelectionLimit);
$: {
    allowListSatisfying('"SelectionList" attribute', SelectionList, ValueIsObject);
    if (SelectionList == null) {
        SelectionList = [];
    }
    let newSelectionSet = new WeakMap(), newSelectionCount = 0;
    SelectionList.forEach((Item) => {
        let Key = KeyOf(Item);
        if (Key in ItemSet) {
            if (!newSelectionSet.has(Item)) {
                if ((SelectionLimit == null) || (newSelectionCount < SelectionLimit)) {
                    newSelectionSet.set(Item, true);
                    newSelectionCount++;
                }
            }
        }
        else {
            throwError('InvalidArgument: one or multiple of the given items to select ' +
                'are not part of the given "List"');
        }
    });
    let SelectionChanged = false;
    List.forEach((Item) => {
        if (SelectionSet.has(Item)) {
            if (!newSelectionSet.has(Item)) {
                SelectionSet.delete(Item);
                SelectionChanged = true;
            }
        }
        else {
            if (newSelectionSet.has(Item)) {
                SelectionSet.set(Item, true);
                SelectionChanged = true;
            }
        }
    });
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** select ****/
export function select(...ItemList) {
    let curSelectionCount = SelectionCount(), SelectionChanged = false;
    ItemList.forEach((Item) => {
        let Key = KeyOf(Item);
        if (Key in ItemSet) {
            if (!SelectionSet.has(Item)) {
                if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
                    SelectionSet.set(Item, true);
                    curSelectionCount++;
                    SelectionChanged = true;
                    dispatch('selected-item', Item);
                }
            }
        }
        else {
            throwError('InvalidArgument: one or multiple of the given items to select ' +
                'are not part of the given "List"');
        }
    });
    SelectionRangeBoundaryA = (ItemList.length === 1 ? ItemList[0] : undefined);
    SelectionRangeBoundaryB = undefined;
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** selectOnly ****/
export function selectOnly(...ItemList) {
    if (ValuesDiffer(selectedItems(), ItemList, 'by-reference')) { // not perfect...
        deselectAll();
        select(...ItemList);
        //    SelectionList = selectedItems()                     // already done before
        //    triggerRedraw()                                                    // dto.
    }
}
/**** selectAll ****/
export function selectAll() {
    let curSelectionCount = SelectionCount(), SelectionChanged = false;
    List.forEach((Item) => {
        if (!SelectionSet.has(Item)) {
            if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
                SelectionSet.set(Item, true);
                curSelectionCount++;
                SelectionChanged = true;
                dispatch('selected-item', Item);
            }
        }
    });
    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
let SelectionRangeBoundaryA;
let SelectionRangeBoundaryB;
/**** selectRange ****/
export function selectRange(RangeBoundary) {
    if (SelectionRangeBoundaryA == null) {
        select(RangeBoundary); // will also set SelectionRangeBoundaryA
        return;
    }
    if (SelectionRangeBoundaryA === RangeBoundary) {
        return;
    }
    if (SelectionRangeBoundaryB != null) {
        deselectRange(SelectionRangeBoundaryB);
    }
    let IndexA = List.indexOf(SelectionRangeBoundaryA);
    let IndexB = List.indexOf(RangeBoundary);
    let firstIndex = Math.min(IndexA, IndexB);
    let lastIndex = Math.max(IndexA, IndexB);
    let curSelectionCount = SelectionCount(), SelectionChanged = false;
    for (let i = firstIndex; i <= lastIndex; i++) {
        if (!SelectionSet.has(List[i])) {
            if ((SelectionLimit == null) || (curSelectionCount < SelectionLimit)) {
                SelectionSet.set(List[i], true);
                curSelectionCount++;
                SelectionChanged = true;
                dispatch('selected-item', List[i]);
            }
        }
    }
    SelectionRangeBoundaryB = RangeBoundary;
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** deselectRange (internal only) ****/
function deselectRange(RangeBoundary) {
    let IndexA = List.indexOf(SelectionRangeBoundaryA);
    let IndexB = List.indexOf(RangeBoundary);
    let firstIndex = Math.min(IndexA, IndexB);
    let lastIndex = Math.max(IndexA, IndexB);
    let SelectionChanged = false;
    for (let i = firstIndex; i <= lastIndex; i++) {
        if (SelectionSet.has(List[i])) {
            SelectionSet.delete(List[i]);
            SelectionChanged = true;
            dispatch('deselected-item', List[i]);
        }
    }
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** deselect ****/
export function deselect(...ItemList) {
    let SelectionChanged = false;
    ItemList.forEach((Item) => {
        let Key = KeyOf(Item);
        if (Key in ItemSet) {
            if (SelectionSet.has(Item)) {
                SelectionSet.delete(Item);
                SelectionChanged = true;
                dispatch('deselected-item', Item);
            }
        }
        else {
            throwError('InvalidArgument: one or multiple of the given items to deselect ' +
                'are not part of the given "List"');
        }
    });
    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** deselectAll ****/
export function deselectAll() {
    let SelectionChanged = false;
    List.forEach((Item) => {
        if (SelectionSet.has(Item)) {
            SelectionSet.delete(Item);
            SelectionChanged = true;
            dispatch('deselected-item', Item);
        }
    });
    SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** toggleSelectionOf - no check for multiply mentioned items ****/
export function toggleSelectionOf(...ItemList) {
    SelectionRangeBoundaryA = undefined;
    let ItemsToBeSelected = [], SelectionChanged = false;
    ItemList.forEach((Item) => {
        let Key = KeyOf(Item);
        if (Key in ItemSet) {
            if (SelectionSet.has(Item)) {
                SelectionSet.delete(Item);
                SelectionChanged = true;
                dispatch('deselected-item', Item);
            }
            else {
                ItemsToBeSelected.push(Item);
            }
        }
        else {
            throwError('InvalidArgument: one or multiple of the given items to select ' +
                'or deselect are not part of the given "List"');
        }
    });
    let curSelectionCount = SelectionCount();
    if (SelectionLimit != null) {
        let maxToBeSelected = SelectionLimit - curSelectionCount;
        if (maxToBeSelected < ItemsToBeSelected.length) {
            ItemsToBeSelected.length = maxToBeSelected;
        }
    }
    ItemsToBeSelected.forEach((Item) => {
        SelectionSet.set(Item, true);
        SelectionChanged = true;
        dispatch('selected-item', Item);
        if (ItemList.length === 1) {
            SelectionRangeBoundaryA = Item;
            SelectionRangeBoundaryB = undefined;
        }
    });
    if (SelectionChanged) {
        SelectionList = selectedItems();
        triggerRedraw();
    }
}
/**** selectedItems ****/
export function selectedItems() {
    let Result = List.filter((Item) => SelectionSet.has(Item));
    return Result;
}
/**** SelectionCount ****/
export function SelectionCount() {
    return List.reduce((Count, Item) => Count + (SelectionSet.has(Item) ? 1 : 0), 0);
}
$: if ((SelectionLimit != null) && (SelectionCount() > SelectionLimit)) {
    let Count = 0;
    List.forEach((Item) => {
        if (SelectionSet.has(Item)) {
            Count++;
            if (Count > SelectionLimit) {
                deselect(Item);
            }
        }
    });
} // decreasing the selection limit with an active selection is very bad style
/**** isSelected ****/
export function isSelected(Item) {
    return SelectionSet.has(Item);
}
/**** handleClick ****/
function handleClick(Event, Item) {
    switch (true) {
        case (Event.buttons === 0) && (Event.button !== 0): return; // workaround
        case (Event.buttons !== 0) && (Event.buttons !== 1): return; // ...for bug
        case (Device.PointingAccuracy === 'coarse'):
            if ( // special handling for touch devices to feel "familiar"
            (SelectionLimit === 1) && !isSelected(Item) &&
                !Event.ctrlKey && !Event.metaKey && !Event.shiftKey) {
                selectOnly(Item);
                break;
            }
        case Event.ctrlKey:
        case Event.metaKey:
            toggleSelectionOf(Item);
            break;
        case Event.shiftKey:
            selectRange(Item);
            break;
        default:
            selectOnly(Item);
            break;
    }
    //  Event.preventDefault()
    //  Event.stopPropagation()
}
//----------------------------------------------------------------------------//
//                           Drag-and-Drop Handling                           //
//----------------------------------------------------------------------------//
let isDragging = false;
let draggedItemList = []; // needed for rendering ony
let InsertionPoint = undefined;
/**** Attributes for Sorting ****/
export let sortable = false; // does this list view support "sorting"?
export let onlyFrom = undefined;
export let neverFrom = undefined;
export let onSortRequest = undefined;
export let onSort = undefined;
$: sortable = allowedBoolean('"sortable" attribute', sortable) || false;
$: allowNonEmptyString('"onlyFrom" CSS selector list', onlyFrom);
$: allowNonEmptyString('"neverFrom" CSS selector list', neverFrom);
$: allowFunction('"onSortRequest" callback', onSortRequest);
$: allowFunction('"onSort" callback', onSort);
/**** Panning Attributes ****/
export let PanSensorWidth = undefined;
export let PanSensorHeight = undefined;
export let PanSpeed = undefined;
$: allowOrdinal('panning sensor width', PanSensorWidth);
$: allowOrdinal('panning sensor height', PanSensorHeight);
$: allowOrdinal('panning speed', PanSpeed);
/**** Attributes for Drag-and-Drop ****/
export let Operations = undefined;
export let DataToOffer = undefined;
export let TypesToAccept = undefined;
export let onOuterDropRequest = undefined;
export let onDroppedOutside = undefined;
export let onDropFromOutside = undefined; // returns act. accepted type (if known)
export let HoldDelay = undefined;
export let onDroppableHold = undefined;
let wantedOperations;
let DataOffered;
let TypesAccepted;
$: wantedOperations = parsedOperations('list of allowed operations', Operations);
$: allowPlainObject('"DataToOffer" attribute', DataToOffer);
$: allowPlainObject('"TypesToAccept" attribute', TypesToAccept);
$: allowFunction('"onOuterDropRequest" callback', onOuterDropRequest);
$: allowFunction('"onDroppedOutside" callback', onDroppedOutside);
$: allowFunction('"onDropFromOutside" callback', onDropFromOutside);
$: allowIntegerInRange('"HoldDelay" attribute', HoldDelay, 0);
$: allowFunction('"onDroppableHold" callback', onDroppableHold);
$: if (!isDragging) { // do not update while already dragging
    DataOffered = Object.assign({}, DataToOffer);
    if ('none' in DataOffered)
        throwError('InvalidArgument: "none" is not a valid data type');
    // @ts-ignore "DataOffered" is definitely not undefined
    if (sortable) {
        DataOffered[privateKey] = '';
    }
}
$: if (!isDragging) { // do not update while already dragging
    TypesAccepted = {};
    if ((TypesToAccept != null) && ('none' in TypesToAccept))
        throwError('InvalidArgument: "none" is not a valid data type');
    for (let Type in TypesToAccept) {
        if (TypesToAccept.hasOwnProperty(Type)) {
            // @ts-ignore "TypesAccepted" is definitely not undefined
            TypesAccepted[Type] = parsedOperations('list of accepted operations for type ' + quoted(Type), TypesToAccept[Type]);
        }
    }
    // @ts-ignore "TypesAccepted" is definitely not undefined
    if (sortable) {
        TypesAccepted[privateKey] = 'copy move';
    }
} // 'copy' because of the better visual feedback from native drag-and-drop
/**** parsedOperations ****/
function parsedOperations(Description, Argument, Default = 'copy move link') {
    let Operations = allowedString(Description, Argument) || Default;
    switch (Operations.trim()) {
        case 'all': return 'copy move link';
        case 'none': return '';
    }
    let OperationList = Operations.trim().replace(/\s+/g, ' ').split(' ');
    allowListSatisfying(Description, OperationList, (Operation) => ValueIsOneOf(Operation, DropOperations));
    return OperationList.reduce((Result, Operation) => (Result.indexOf(Operation) < 0 ? Result + Operation + ' ' : Result), ' ');
}
/**** prepare for drag-and-drop ****/
function hasNonPrivateTypes(TypeSet) {
    for (let Type in TypeSet) {
        if (TypeSet.hasOwnProperty(Type) && (Type !== privateKey)) {
            return true;
        }
    }
    return false;
}
let shrinkable = false;
let extendable = false;
$: if (!isDragging) { // do not update while already dragging
    shrinkable = hasNonPrivateTypes(DataOffered);
    extendable = hasNonPrivateTypes(TypesAccepted);
}
/**** ad-hoc Dummy Creation ****/
function dynamicDummy(DroppableExtras, Element) {
    let auxiliaryElement = Element.cloneNode(true);
    auxiliaryElement.style.display = 'block';
    auxiliaryElement.style.position = 'absolute';
    auxiliaryElement.style.left = (document.body.scrollWidth + 100) + 'px';
    auxiliaryElement.style.width = Element.clientWidth + 'px'; // not perfect
    auxiliaryElement.style.height = Element.clientHeight + 'px'; // dto.
    if (draggedItemList.length > 1) { // called after "onDragStart"
        let Badge = document.createElement('div');
        Badge.setAttribute('style', 'display:block; position:absolute; ' +
            'top:-10px; right:-10px; width:20px; height:20px; ' +
            'background:red; color:white; ' +
            'border:none; border-radius:10px; margin:0px; padding:0px 4px 0px 4px; ' +
            'line-height:20px; text-align:center');
        Badge.innerText = '+' + (draggedItemList.length - 1);
        auxiliaryElement.appendChild(Badge);
    }
    document.body.appendChild(auxiliaryElement);
    setTimeout(() => {
        document.body.removeChild(auxiliaryElement);
    }, 0);
    return auxiliaryElement;
}
/**** onDragStart ****/
function onDragStart(DroppableExtras) {
    isDragging = true;
    if (!isSelected(DroppableExtras.Item)) {
        selectOnly(DroppableExtras.Item);
    }
    draggedItemList = DroppableExtras.ItemList = selectedItems();
    return { x: 0, y: 0 };
}
/**** onDragEnd ****/
function onDragEnd(x, y, dx, dy, DroppableExtras) {
    isDragging = false;
    delete DroppableExtras.ItemList;
    draggedItemList.length = 0;
}
/**** onDropped ****/
function onDropped(x, y, Operation, TypeTransferred, DataTransferred, DropZoneExtras, DroppableExtras) {
    let droppedHere = (List === (DropZoneExtras && DropZoneExtras.List));
    if (!droppedHere) {
        if (onDroppedOutside == null) {
            let droppedItems = DroppableExtras.ItemList;
            let DroppableSet = SetOfItemsIn(droppedItems);
            for (let i = List.length - 1; i >= 0; i--) {
                let Key = KeyOf(List[i]);
                if (Key in DroppableSet) {
                    List.splice(i, 1);
                }
            }
            dispatch('removed-items', droppedItems.slice());
            triggerRedraw();
        }
        else {
            try {
                onDroppedOutside(x, y, Operation, TypeTransferred, DataTransferred, DropZoneExtras, DroppableExtras);
            }
            catch (Signal) {
                console.error('RuntimeError: callback "onDroppedOutside" failed', Signal);
            } // no event to be dispatched (there is already the callback)
            triggerRedraw(); // just to be on the safe side
        }
    }
}
/**** onDroppableEnter ****/
function onDroppableEnter(x, y, Operation, offeredTypeList, DroppableExtras, DropZoneExtras) {
    if ((List === (DroppableExtras && DroppableExtras.List)) &&
        (List.indexOf(DroppableExtras.Item) >= 0) && // not a foreign item
        (DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0)) { // don't allow own dragged items to be dropped onto themselves
        InsertionPoint = undefined;
        triggerRedraw();
        return false;
    }
    let mayBeInsertedHere = true; // because dnd-action already checked a bit
    if (List === (DroppableExtras && DroppableExtras.List)) { // own elements
        if (sortable) {
            if (onSortRequest != null) {
                try {
                    mayBeInsertedHere = onSortRequest(x, y, DroppableExtras, DropZoneExtras);
                }
                catch (Signal) {
                    mayBeInsertedHere = false;
                    console.error('RuntimeError: callback "onSortRequest" failed', Signal);
                }
            }
        }
        else { // not sortable? then own list items may not be dropped here
            mayBeInsertedHere = false;
        }
    }
    else { // foreign elements want to be dropped here
        if (onOuterDropRequest != null) {
            try {
                mayBeInsertedHere = onOuterDropRequest(x, y, Operation, offeredTypeList, DroppableExtras, DroppableExtras);
            }
            catch (Signal) {
                mayBeInsertedHere = false;
                console.error('RuntimeError: callback "onOuterDropRequest" failed', Signal);
            }
        }
    }
    InsertionPoint = (mayBeInsertedHere ? DropZoneExtras.Item : undefined);
    triggerRedraw();
    return mayBeInsertedHere && (Operation !== 'link');
}
/**** onDroppableMove ****/
const onDroppableMove = onDroppableEnter;
/**** onDroppableLeave ****/
function onDroppableLeave(DroppableExtras, DropZoneExtras) {
    InsertionPoint = undefined;
    //  triggerRedraw()
}
/**** onDrop ****/
function onDrop(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras) {
    InsertionPoint = undefined;
    if ((List === (DroppableExtras && DroppableExtras.List)) &&
        (List.indexOf(DroppableExtras.Item) >= 0) && // not a foreign item
        (DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0)) { // don't allow own dragged items to be dropped onto themselves
        InsertionPoint = undefined;
        triggerRedraw();
        return 'none';
    }
    if (List === (DroppableExtras && DroppableExtras.List)) { // own elements
        if (sortable) {
            let droppedItems = DroppableExtras.ItemList;
            if (onSort == null) {
                let DroppableSet = SetOfItemsIn(droppedItems);
                for (let i = List.length - 1; i >= 0; i--) {
                    let Key = KeyOf(List[i]);
                    if (Key in DroppableSet) {
                        List.splice(i, 1);
                    }
                }
                let InsertionIndex = List.indexOf(DropZoneExtras.Item);
                if (InsertionIndex < 0) {
                    InsertionIndex = List.length;
                } // for append
                // @ts-ignore argument list of "apply" is known to be correct
                List.splice.apply(List, [InsertionIndex, 0].concat(droppedItems));
                dispatch('sorted-items', [droppedItems.slice(), InsertionIndex]);
                triggerRedraw();
            }
            else {
                try {
                    onSort(DropZoneExtras.Item, droppedItems.slice());
                }
                catch (Signal) {
                    console.error('RuntimeError: callback "onSort" failed', Signal);
                } // no event to be dispatched (there is already the callback)
                triggerRedraw(); // just to be on the safe side
            }
            return Operation; // should be 'move', but 'copy' gives better feedback
        }
        else {
            return 'none';
        }
    }
    else { // foreign elements want to be dropped here
        if (onDropFromOutside == null) {
            let ItemsToBeInserted = (DroppableExtras && DroppableExtras.ItemList);
            if (!ValueIsList(ItemsToBeInserted)) {
                return 'none';
            }
            let InsertionIndex = List.indexOf(DropZoneExtras.Item);
            if (InsertionIndex < 0) {
                InsertionIndex = List.length;
            } // for "append"
            // @ts-ignore argument list of "apply" is known to be correct
            List.splice.apply(List, [InsertionIndex, 0].concat(ItemsToBeInserted));
            dispatch('inserted-items', [ItemsToBeInserted.slice(), InsertionIndex]);
            triggerRedraw();
            return undefined; // accepted type is unknown
        }
        else {
            let acceptedType = undefined;
            try {
                acceptedType = onDropFromOutside(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras);
            }
            catch (Signal) {
                console.error('RuntimeError: callback "onSort" failed', Signal);
            } // no event to be dispatched (there is already the callback)
            triggerRedraw(); // just to be on the safe side
            return acceptedType; // accepted type is unknown
        }
    }
}
/**** scale ****/
function scale(Element, Options) {
    const currentStyle = window.getComputedStyle(Element);
    const currentTransform = (currentStyle.transform === 'none' ? '' : currentStyle.transform);
    return {
        delay: 0, duration: (Options.duration === 0 ? 0 : Options.duration || 300),
        css: (t, u) => (`transform: ${currentTransform} translateX(-${50 * u}%) scaleX(${t})`)
    };
}
/**** TransitionStarted ****/
function TransitionStarted() {
    ListViewElement.classList.add('transitioning');
}
function TransitionEnded() {
    ListViewElement.classList.remove('transitioning');
}
/**** SetOfItemsIn ****/
function SetOfItemsIn(ItemList) {
    let ItemSet = Object.create(null);
    ItemList.forEach((Item) => {
        let Key = KeyOf(Item);
        ItemSet[Key] = Item;
    });
    return ItemSet;
}
/**** triggerRedraw ****/
function triggerRedraw() { List = List; }
</script>
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
  .defaultListView > :global(.ListItemView > *) { /* disables wobbling */
    pointer-events:none;
  }

  .defaultListView:not(.transitioning) > :global(.ListItemView:hover:not(.dragged))    { border:solid 1px }
  .defaultListView:not(.transitioning) > :global(.ListItemView.selected:not(.dragged)) { background:dodgerblue }

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
