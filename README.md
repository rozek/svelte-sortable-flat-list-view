# svelte-sortable-flat-list-view #

a sortable view for flat lists which also supports dragging items into and out of a list

It is based on [svelte-drag-and-drop-actions](https://github.com/rozek/svelte-drag-and-drop-actions) and, consequently, on HTML5 native Drag-and-Drop.

**NPM users**: please consider the [Github README](https://github.com/rozek/svelte-sortable-flat-list-view/blob/main/README.md) for the latest description of this package (as updating the docs would otherwise always require a new NPM package version)

**Mobile Developers**: since many mobile platforms lack support for native HTML5 drag-and-drop, you should consider importing [svelte-drag-drop-touch](https://github.com/rozek/svelte-drag-drop-touch) as a polyfill (a simple import of that package will suffice - there is no extra programming needed)

## Installation ##

```
npm install svelte-sortable-flat-list-view
```

## Examples ##

**Warning**: the Svelte REPL does not seem to parse TypeScript sources properly...

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

### Dragging beyond List Bounds ###

## Build Instructions ##

You may easily build this package yourself.

Just install [NPM](https://docs.npmjs.com/) according to the instructions for your platform and follow these steps:

1. either clone this repository using [git](https://git-scm.com/) or [download a ZIP archive](https://github.com/rozek/svelte-sortable-flat-list-view/archive/refs/heads/main.zip) with its contents to your disk and unpack it there
2. open a shell and navigate to the root directory of this repository
3. run `npm install` in order to install the complete build environment
4. execute `npm run build` to create a new build
