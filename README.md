# svelte-sortable-flat-list-view #

a sortable view for flat lists which also supports dragging items into and out of a list

It is based on [svelte-drag-and-drop-actions](https://github.com/rozek/svelte-drag-and-drop-actions) and, consequently, on HTML5 native Drag-and-Drop.

**NPM users**: please consider the [Github README](https://github.com/rozek/svelte-sortable-flat-list-view/blob/main/README.md) for the latest description of this package (as updating the docs would otherwise always require a new NPM package version)

**Mobile Developers**: since many mobile platforms lack support for native HTML5 drag-and-drop, you should consider importing [svelte-drag-drop-touch](https://github.com/rozek/svelte-drag-drop-touch) as a polyfill (a simple import of that package will suffice - there is no extra programming needed)

## Installation ##

```
npm install svelte-sortable-flat-list-view
```

## Usage ##

`svelte-sortable-flat-list-view` should be imported within a module script (perhaps together with `svelte-drag-drop-touch`) and may then be used in your markup:

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

More detailled examples for a variety of use cases can be found below.

## API ##

**a description will follow by tomorrow, for now just have a look into the examples**

### exported Types ###

For TypeScript users, `svelte-sortable-flat-list-view` exports the following types

* `type ListDroppableExtras = { List:any[], Item:any, ItemList?:any[] }` -
* `type ListDropZoneExtras  = { List:any[], Item:any }` -

### exported Svelte Props ###

`svelte-sortable-flat-list-view` exports the following Svelte "props" (shown with TypeScript type annotations - JavaScript users may simply ignore them):

* `class:string` -
* `style:string` - <br>&nbsp;<br>
* `List:{}[]` -
* `Key:string|Function` -
* `SelectionLimit:number` -
* `InsertionRegion:string` -
* `AttachmentRegion:string` -
* `Placeholder:string` -
* `sortable:boolean` - <br>&nbsp;<br>
* `onlyFrom:string` -
* `neverFrom:string` -
* `onSortRequest:(x:number,y:number, DroppableExtras:ListDroppableExtras, DropZoneExtras:ListDropZoneExtras) => boolean` -
* `onSort:(beforeItem:any|undefined, ItemList:{}[]) => void` - <br>&nbsp;<br>
* `Operations:string` -
* `DataToOffer:DataOfferSet` -
* `TypesToAccept:TypeAcceptanceSet` -
* `onOuterDropRequest:(x:number,y:number, Operation:DropOperation, offeredTypeList:string[], DroppableExtras:any, DropZoneExtras:ListDropZoneExtras) => boolean` -
* `onDroppedOutside:(x:number,y:number, Operation:DropOperation, TypeTransferred:string, DataTransferred:any, DropZoneExtras:any, DroppableExtras:ListDroppableExtras) => void` -
* `onDropFromOutside:(x:number,y:number, Operation:DropOperation, DataOffered:DataOfferSet, DroppableExtras:any, DropZoneExtras:ListDropZoneExtras) => string | undefined` -

## CSS Classes ##

Without explicitly specifying a CSS class for a list view, standard styling is applied. Otherwise, the following selectors may be used to define custom list view styling:

* `ListView` - 
* `ListView > .ListItemView` - 
* `ListView > .ListItemView > *` - 
* `ListView > .ListItemView:hover:not(.dragged)` - 
* `ListView > .ListItemView.selected:not(.dragged)` - 
* `ListView > .ListItemView.dragged` - 
* `ListView > .ListItemView.hovered:not(.dragged)` - 
* `ListView > .AttachmentRegion` - 
* `ListView > .AttachmentRegion.hovered` - 
* `ListView > .Placeholder` - 

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
