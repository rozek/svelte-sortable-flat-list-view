# svelte-sortable-flat-list-view #

a sortable view for flat lists which also supports dragging items into and out of a list

It is based on [svelte-drag-and-drop-actions](https://github.com/rozek/svelte-drag-and-drop-actions) and, consequently, on HTML5 native Drag-and-Drop.

**some of its Features:**

All [examples](#examples) are live and may be changed on the fly!

* works on mobile devices (when combined with [svelte-drag-drop-touch](https://github.com/rozek/svelte-drag-drop-touch))
* provides a configurable placeholder for empty lists (see [example](https://svelte.dev/repl/bf8eeeffc1be47be976eeb7ceb58a140))
* can render list elements itself or use a given template (see [example](https://svelte.dev/repl/d0314246026c48c685ed97542b56e518))
* can be styled using a given set of selectors (see [example](https://svelte.dev/repl/806db6bfe11b485aa4b9268492e32088))
* supports single and multiple selection (with a configurable limit of selectable elements, see [example](https://svelte.dev/repl/d12c72cd0bc84d01b716ab9394965115))
* supports sorting elements from a given handle only (rather than from the whole element itself, see [example](https://svelte.dev/repl/4adf5f8c28a549edae25eeb94edd281f))
* recognizes when a draggable stands still (i.e., is "held") over a sortable list view for a given time (see [example](https://svelte.dev/repl/b179ed1e9f584bd687f2588da2129f12))
* supports horizontal lists (see [example](https://svelte.dev/repl/a960543f3f88431ab30592fea997ac91)) and - up to a certain extent - even two-dimensonal ones (see [example](https://svelte.dev/repl/e9d4a2312d1e436ba27a6914d590acec))
* does the sorting itself or gives you full control over it (see [example](https://svelte.dev/repl/82d3d414e81d4680b3210c08f23a16fa))
* supports dragging of external elements into a list (see [example](https://svelte.dev/repl/ee96b00b21914807ba72eefaa5b618e1))
* supports dragging of list elements onto external drop zones (see [example](https://svelte.dev/repl/3290cdf6cd61453f9b5a4c867c38ae7a))
* supports dragging of list elements between lists (see [example](https://svelte.dev/repl/26e9bb4cebd0431e931d66c521061bfb))
* provides lots of live(!) [examples](#examples) for many use cases
* however, unfortunately, `svelte-sortable-flat-list-view` may also suffer from any bugs in the browser implementations of native HTML drag-and-drop (thinking of Safari 13.0/13.1, f.e.) if they can not be compensated by the author

**NPM users**: please consider the [Github README](https://github.com/rozek/svelte-sortable-flat-list-view/blob/main/README.md) for the latest description of this package (as updating the docs would otherwise always require a new NPM package version)

**Mobile Developers**: since many mobile platforms lack support for native HTML5 drag-and-drop, you should consider importing [svelte-drag-drop-touch](https://github.com/rozek/svelte-drag-drop-touch) as a polyfill (a simple import of that package will suffice - there is no extra programming needed)

*Please note: this package is currently under active development. Be invited to follow me on this road (with many detours searching for a [proper build environment](https://github.com/rozek/build-configuration-study), preparing [npm packages for Svelte](https://github.com/rozek/save-to-file) or struggling with singletons that turn out not to be so "single" in reality), but don't expect this package to be stable until perhaps end of July 2021 (sorry for frequent updates until then - sometimes you may see even multiple npm publications per day...).*

## Installation ##

```
npm install svelte-sortable-flat-list-view
```

## Usage ##

`svelte-sortable-flat-list-view` should be imported in a module context (perhaps together with `svelte-drag-drop-touch`) and may then be used in your markup:

```
<script context="module">
  import DragDropTouch from 'svelte-drag-drop-touch'
  import ListView      from 'svelte-sortable-flat-list-view'
</script>

<script>
  let List = []
</script>

<ListView {List}/>
```

More detailled [examples](#examples) for a variety of use cases can be found below.

In addition, this repo also contains a file `example_ListView_on_web_page.html` which demonstrates how to use a ListView on a web page (i.e., outside of Svelte)

## API ##

`svelte-sortable-flat-list-view` emits some Svelte events and exports some types (for TypeScript users) and properties (for anybody), as shown below. 

### exported Types ###

TypeScript programmers may import the following types in order to benefit from static type checking (JavaScript programmers may simply skip this section):

* **`type ListDroppableExtras = { List:any[], Item:any, ItemList:any[] }`**<br>`ListDroppableExtras` defines the shape of `DroppableExtras` (as defined by [svelte-drag-and-drop-actions](https://github.com/rozek/svelte-drag-and-drop-actions)) when a `Droppable` which is dragged over a list item that may serve as a `DropZone` comes from this (or another) `svelte-sortable-flat-list-view` instance
* **`type ListDropZoneExtras = { List:any[], Item:any }`**<br>`ListDropZoneExtras` defines the shape of `DropZoneExtras` (as defined by [svelte-drag-and-drop-actions](https://github.com/rozek/svelte-drag-and-drop-actions)) when a `Droppable` is dragged over this drop zone

### exported Svelte Props ###

`svelte-sortable-flat-list-view` exports the following Svelte "props" (shown with TypeScript type annotations - JavaScript users may simply ignore them):

* **`class?:string`**<br>list views come with a default styling. However, if you set the (optional) `class` attribute (to a CSS class name), the list view assumes that you will take over any styling and remove its defaults (see below for more details)
* **`style?:string`**<br>use the (optional) `style` attribute to set important CSS properties for the list view itself (not its item views). "Important" CSS properties could, f.e., control position and size of a list view and set basic visual parameters such as background, borders or text size and color<br>&nbsp;<br>
* **`List:{}[]`**<br>the mandatory `List` attribute accepts the actual list to be shown. It should be a JavaScript array with arbitrary objects as elements. Note: **lists of JavaScript primitives will be rejected!**
* **`Key?:string|Function`**<br>the optional `Key` attribute specifies which string to be used as the (unique) "key" of a list item - such "keys" are required by Svelte for proper rendering of lists. `Key` may either be set to the (fixed) name of a list item property containing the key or to a function which receives a list item and that item's current index in the list and returns that item's key (which must be a string). If omitted, the list item itself is used as its key (after conversion into a string). List item keys must be unique within the whole list - or Svelte will throw an error 
* **`SelectionLimit?:number`**<br>by default, any number of list items may be selected simultaneously. By setting the (optional) `SelectionLimit` attribute to an ordinal number, you may set an upper limit for selections
* **`SelectionList:{}[]`**<br>the optional `SelectionList` attribute specifies which elements of `List` are to be selected in the list view. It must contain elements of `List` only and should not contain more than `SelectionLimit` elements (otherwise only the first `SelectionLimit` elements will be considered and all others removed). If `SelectionList` is bound to a variable, that variable also reflects any selection changes made within the list view
* **`AttachmentRegion?:string`**<br>in order to allow for appending list elements while dragging, a specific "attachment region" is rendered at the end of any list. Set the (optional) `AttachmentRegion` attribute to the HTML you want to be shown in that region - by default, attachment regions are just empty
* **`Placeholder?:string`**<br>empty lists show a "placeholder" instead of just an empty space. Set the (optional) `Placeholder` attribute to the HTML you want to be shown in that placeholder - by default, the text "(empty list)" is shown
* **`withTransitions:boolean`**<br>by default, the appearance and disappearance of individual list items is shown using a short animation. If you prefer immediate display updates, just set the (optional) `withTransitions` atttribute to `false`
* **`sortable?:boolean`**<br>set the (optional) `sortable` attribute to `true` if you want the list view to support sorting - or `false` otherwise. By default, sorting is *not* supported (such list views just support selections)<br>&nbsp;<br>
* **`onlyFrom?:string`**<br>`onlyFrom` is an optional, comma-separated list of CSS selectors identifying the inner elements of a list item view, from which a drag operation must be started in order to be allowed. If `onlyFrom` is missing, no `onlyFrom` restriction is applied
* **`neverFrom?:string`**<br>`neverFrom` is an optional, comma-separated list of CSS selectors identifying the inner elements of a list item view, from which a drag operation must *never* be started in order to be allowed. If `neverFrom` is missing, no `neverFrom` restriction is applied
* **`onSortRequest?:(x:number,y:number, DroppableExtras:ListDroppableExtras, DropZoneExtras:ListDropZoneExtras) => boolean`**<br>`onSortRequest` is an optional callback which (when invoked during sorting) indicates whether the currently dragged list items may be inserted immediately before the currently hovered list element or not. `x` and `y` contain the current mouse pointer (or finger) position within the hovered list item, `DroppableExtras` are the configured "extras" for the currently dragged list item and `DropZoneExtras` those for the currently hovered one. If `onSortRequest` is missing, insertion is allowed everywhere in the list
* **`onSort?:(beforeItem:any|undefined, ItemList:{}[]) => void`**<br>`onSort` is an optional callback which (when invoked during sorting) performs the actual reordering of list items - it can be used to update the state of the surrounding Svelte application if the default behaviour (which simply updates the given list and emits an event) does not suffice. The callback receives the sequence `ItemList` of list items to be moved (given in their original order) and the list item `beforeItem` before which the dragged list items should be inserted - if `beforeItem` is `undefined`, the dragged items should just be appended to the list<br>&nbsp;<br>
* **`Operations?:string`**<br>`Operations` is either a blank-separated list of drop operations (`'copy'`, `'move'` or `'link'`), the keyword `all` (which includes all three available operations) or the keyword `none` (which effectively suppresses dropping) and specifies which kind of data transfer list items support when dropped outside of their list - by default, no such drop is allowed 
* **`DataToOffer?:DataOfferSet`**<br>`DataToOffer` is a plain JavaScript object whose keys represent the various data formats a droppable list item supports and whose corresponding values contain the transferrable data in that format. Often, the given keys denote MIME formats (which simplifies data transfer between different applications) or contain the special value "DownloadURL", but - in principle - any string (except `none`) may be used
* **`TypesToAccept?:TypeAcceptanceSet`**<br>`TypesToAccept` is a plain JavaScript object whose keys represent the various data formats a list item serving as drop zone may accept and whose corresponding values contain a blank-separated, perhaps empty, list of supported drop operations for that format. Often, the given keys denote MIME formats (which simplifies data transfer between different applications) or contain the special value "DownloadURL", but - in principle - any string (except `none`) may be used. Note: since native HTML5 drag-and-drop implementations often fail reporting a correct "dropEffect", the given drop operations can not be properly checked - with the exception, that types with empty operation lists will never be accepted
* **`onDroppedOutside?:(x:number,y:number, Operation:DropOperation, TypeTransferred:string|undefined, DataTransferred:any|undefined, DropZoneExtras:any, DroppableExtras:ListDroppableExtras) => void`**<br>`onDroppedOutside` is an optional callback which is invoked when one or multiple items of this list were dropped somewhere outside this list. It may be used for any housekeeping required - or even for performing the actual data transfer in case that the foreign drop zone is not able to do so. `x` and `y` contain the mouse pointer (or finger) position within the foreign drop zone when the list item(s) were dropped, `Operation` contains the accepted data transfer operation (i.e., `'copy'`, `'move'` or `'link'`), `TypeTransferred` the accepted type and `DataTransferred` the actually accepted data, `DropZoneExtras` are the configured "extras" for the foreign drop zone and `DroppableExtras` those for the actually dragged list item. `TypeTransferred` and `DataTransferred` may both be `undefined` in order to indicate that there values are unknown. If `onDroppedOutside` is missing, it simply does not get called and the actual drop zone has to perform the data transfer itself
* **`onOuterDropRequest?:(x:number,y:number, Operation:DropOperation, offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:ListDropZoneExtras) => boolean`**<br>`onDroppedOutside` is an optional callback which is invoked when a draggable object that is not already an item of this list is dragged over an item of this list. It should return `true` if dropping is allowed or `false` otherwise. `x` and `y` contain the current mouse pointer (or finger) position within the list item that should serve as a drop zone, `Operation` the requested data transfer operation (i.e., `'copy'`, `'move'` or `'link'`) and `offeredTypeList` a list of types the dragged object offers. `DroppableExtras` are the configured "extras" for the currently dragged (foreign) object and `DropZoneExtras` those for the currently hovered list item. If `onOuterDropRequest` is missing the permission to drop or not to drop is determined by comparing the requested data transfer types and operations with those configured for this list
* **`onDropFromOutside?:(x:number,y:number, Operation:DropOperation, DataOffered:DataOfferSet, DroppableExtras:any, DropZoneExtras:ListDropZoneExtras) => string | undefined`**<br>`onDropFromOutside` is an optional callback which is invoked after a draggable object that is not already an item of this list was dropped onto an item of this list. It should either return the actually accepted data type (i.e., one of the keys from `DataOffered`) or `none` if the drop is not acceptable. If `undefined` is returned instead, the drop operation is considered accepted, but the accepted data type remains unknwon. `x` and `y` contain the current mouse pointer (or finger) position within the list item that served as a drop zone, `Operation` the requested data transfer operation (i.e., `'copy'`, `'move'` or `'link'`) and `DataOffered` a JavaScript object, whose keys represent the various data formats offered and whose corresponding values contain the offered data in that format. `DroppableExtras` are the configured "extras" for the currently dragged (foreign) object and `DropZoneExtras` those for the list item acting as drop zone. If `onDropFromOutside` is missing, the list view only accepts items that match the configured data transfer types and operations for this list and look like items of another `svelte-sortable-flat-list-view`<br>&nbsp;<br>
* **`HoldDelay?:number`**<br>when a droppable has entered a list item view serving as a drop zone and remains there for at least `HoldDelay` milliseconds without much movement, the `onDroppableHold` callback is invoked (if it exists). The property is optional: when missing, `onDroppableHold` will never be called
* **`onDroppableHold?: (x:number,y:number, DroppableExtras:any, DropZoneExtras:ListDropZoneExtras) => void`**<br>`onDroppableHold` is an optional callback which (when invoked) indicates that a droppable whose data is at least partially acceptable, stood still for at least `HoldDelay` milliseconds within the bounds of a list item view. `x` and `y` contain the current coordinates of the mouse or finger relative to the list item view, `DroppableExtras` are any `Extras` configured for the held droppable and `DropZoneExtras` any `Extras` configured for the list item view that acts as a drop zone. **Warning**: be careful with what to do within that callback - if you disturb the flow of events (e.g., by invoking `window.alert`), the visual feedback for the list view may get mixed up!<br>&nbsp;<br>
* **`PanSensorWidth?:number`**<br>`svelte-sortable-flat-list-view` supports automatic scrolling (aka "panning") of only partially visible lists while dragging. `PanSensorWidth` is an optional ordinal number (defaulting to `20`) which specifies the width (in pixels) of the horizontal pan sensor area: panning starts as soon as the mouse pointer (or finger) gets closer than the given number of pixels to the left or right border of the list view. If set to `0`, no horizontal panning will be performed
* **`PanSensorHeight?:number`**<br>`svelte-sortable-flat-list-view` supports automatic scrolling (aka "panning") of only partially visible lists while dragging. `PanSensorHeight` is an optional ordinal number (defaulting to `20`) which specifies the height (in pixels) of the vertical pan sensor area: panning starts as soon as the mouse pointer (or finger) gets closer than the given number of pixels to the upper or lower border of the list view. If set to `0`, no vertical panning will be performed
* **`PanSpeed?:number`**<br>`svelte-sortable-flat-list-view` supports automatic scrolling (aka "panning") of only partially visible lists while dragging. `PanSpeed` is an optional ordinal number (defaulting to `10`) which specifies the "speed" of panning - values in the range of 10...20 are reasonable choices, but it is always a good idea to make this parameter configurable for the users of your application. If set to `0`, no panning will be performed

### emitted Svelte Events ###

* **`'selected-item'`** (`const Item:any = Event.detail`)<br>`selected-item` is emitted whenever a list item becomes selected, `Event.detail` refers to the newly selected item
* **`'deselected-item'`** (`const Item:any = Event.detail`)<br>`deselected-item` is emitted whenever a list item becomes deselected, `Event.detail` refers to the no longer selected item
* **`'sorted-items'`** (`const [sortedItems:any[],InsertionIndex:number] = Event.detail`)<br>`sorted-items` is emitted after one or multiple list items have been moved to new positions within their list using the default approach implemented by `svelte-sortable-flat-list-view` itself (i.e., not by a given `onSort` callback). `Event.detail` contains a list with two elements: the first one being the list of repositioned items and the second one being the new index of the first repositioned item (all items are placed one after the other)
* **`'inserted-items'`** (`const [ItemsToBeInserted:any[],InsertionIndex:number] = Event.detail`)<br>`inserted-items` is emitted after one or multiple items of another list have been moved into this one using the default approach implemented by `svelte-sortable-flat-list-view` itself (i.e., not by a given `onDropFromOutside` callback). `Event.detail` contains a list with two elements: the first one being the list of inserted (i.e., new) items and the second one being the index of the first inserted item (all items are placed one after the other)
* **`'removed-items'`** (`const ItemList:any[] = Event.detail`)<br>`removed-items` is emitted after one or multiple items of this list have been dropped onto another drop zone using the default approach implemented by `svelte-sortable-flat-list-view` itself (i.e., not by a given `onDroppedOutside` callback). `Event.detail` contains a list of all removed list items

## CSS Classes ##

Without explicitly specifying a CSS class for a list view, standard styling is applied. Otherwise, the following selectors may be used to define custom list view styling (assuming that you instantiate your list view with a class attribute containing `ListView`, like so: `<sortableFlatListView class="ListView" .../>`):

* **`ListView`**<br>use this selector to style the list view itself (i.e., not the individual items). In combination with the `ListView > .ListItemView` selector, this also allows for horizontal or even two-dimensional list views
* **`ListView > .ListItemView`**<br>use this selector to style any list item view. In combination with the `ListView` selector itself, this also allows for horizontal or even two-dimensional list views
* **`ListView > .ListItemView > *`**<br>use this selector to style the actual contents of a list item view
* **`ListView:not(.transitioning) > .ListItemView:hover:not(.dragged)`**<br>you may want some visual feedback whenever a mouse pointer hovers over a list item. If so, use this selector to provide it (`transitioning` is a class added to all list item view elements which are going to appear or disappear - and, usually, you don't want to apply the styling of hovered elements to those)
* **`ListView:not(.transitioning) > .ListItemView.selected:not(.dragged)`**<br>if list items are selected, there should be some visual feedback. Use this selector to provide it (`transitioning` is a class added to all list item view elements which are going to appear or disappear - and, usually, you don't want to apply the styling of selected elements to those)
* **`ListView > .ListItemView.dragged`**<br>if list items are dragged, there should be some visual feedback. Use this selector to provide it
* **`ListView > .ListItemView.hovered:not(.dragged)`**<br>if list items are dragged over other list items which may serve a drop zones, those items should visually indicate that a drop would be allowed. Use this selector to do so
* **`ListView > .AttachmentRegion`**<br>in order to allow for appending list elements while dragging, a specific "attachment region" is rendered at the end of any list. Use this selector to style it
* **`ListView > .AttachmentRegion.hovered`**<br>normally, the "attachment region" does not stand out. Use this selector to change that while a list item is dragged over it
* **`ListView > .Placeholder`**<br>empty lists show a "placeholder" instead of just an empty space. Use this selector to style it

**Important**: whenever you change the style of a list item during dragging, you should take great care that HTML5 drag-and-drop still recognizes the styled list item as a draggable or drop zone. More precisely: you should avoid to move drop zones away from the mouse pointer (or finger, resp.), hide draggables or drop zones completely (e.g., with `display:none`) or change their sensitivity to mouse and touch events (with `pointer-events:none`)

There is an example ([ListView with custom CSS classes](https://svelte.dev/repl/806db6bfe11b485aa4b9268492e32088)) which specifically demonstrates how to style a list view using the abovementioned selectors.

## Examples ##

A few examples may help understanding how `svelte-sortable-flat-list-view` may be used.

### Visual Appearance ###

* [empty List](https://svelte.dev/repl/bf8eeeffc1be47be976eeb7ceb58a140) - empty lists display a placeholder rather than just an empty area
* [non-empty List](https://svelte.dev/repl/1b78167b5b374deab38a414767351a89) - in the simplest case, a list view shows list item "keys", line by line
* [ListView with given Template](https://svelte.dev/repl/d0314246026c48c685ed97542b56e518) - if given, a "template" is used to render individual list items
* [ListView with custom CSS classes](https://svelte.dev/repl/806db6bfe11b485aa4b9268492e32088) - sometimes, it is sufficient to provide custom CSS classes for rendering

### Selection ###

* [single selection](https://svelte.dev/repl/d881dba9a6b54286aa4159366adde9a5) - this example shows a ListView which supports the selection of single items only
* [multiple selection](https://svelte.dev/repl/d12c72cd0bc84d01b716ab9394965115) - multiple selections (with optionally predefined limits) are supported as well

### Sorting ###

* [sorting with single selection](https://svelte.dev/repl/7de55ceb5ae841499d8752addf33fbce) - in the simplest case, individual list items may be rearranged with mouse or finger
* [sorting with multiple selections](https://svelte.dev/repl/6ae6b28514c742f6a911c7b72188570c) - rearranging multiple list items at once is supported as well
* [sorting with handles](https://svelte.dev/repl/4adf5f8c28a549edae25eeb94edd281f) - on mobile platforms, it is preferred to drag list items from handles only
* [holding a dragged list item](https://svelte.dev/repl/b179ed1e9f584bd687f2588da2129f12) - demonstrates what happens if a Droppable is held over a list item for a long time 
* [sorting a horizontal list](https://svelte.dev/repl/a960543f3f88431ab30592fea997ac91) - with proper CSS Styling, a sortable list view may also arrange its items horizontally
* [sorting a two-dimensional list](https://svelte.dev/repl/e9d4a2312d1e436ba27a6914d590acec) - with proper CSS Styling, even 2-dimensional lists may become sortable
* [sorting with callbacks](https://svelte.dev/repl/82d3d414e81d4680b3210c08f23a16fa) - optional callbacks give full control over sorting "semantics"

### Dragging beyond List Bounds ###

* [dragging items from a source into a list](https://svelte.dev/repl/ee96b00b21914807ba72eefaa5b618e1) - add new list items by dragging them onto the list view
* [dragging list items into a trashcan](https://svelte.dev/repl/3290cdf6cd61453f9b5a4c867c38ae7a) - delete list items by dragging them into a trashcan
* [dragging items between lists](https://svelte.dev/repl/26e9bb4cebd0431e931d66c521061bfb) - of course, you may also drag items from one list into another

## Build Instructions ##

You may easily build this package yourself.

Just install [NPM](https://docs.npmjs.com/) according to the instructions for your platform and follow these steps:

1. either clone this repository using [git](https://git-scm.com/) or [download a ZIP archive](https://github.com/rozek/svelte-sortable-flat-list-view/archive/refs/heads/main.zip) with its contents to your disk and unpack it there
2. open a shell and navigate to the root directory of this repository
3. run `npm install` in order to install the complete build environment
4. execute `npm run build` to create a new build

See the author's [build-configuration-study](https://github.com/rozek/build-configuration-study) for a general description of his build environment.

## License ##

[MIT License](LICENSE.md)
