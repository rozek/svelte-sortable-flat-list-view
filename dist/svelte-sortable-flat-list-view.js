(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('svelte-drag-and-drop-actions'), require('svelte-device-info'), require('locally-unique-id-generator'), require('javascript-interface-library')) :
    typeof define === 'function' && define.amd ? define(['svelte-drag-and-drop-actions', 'svelte-device-info', 'locally-unique-id-generator', 'javascript-interface-library'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, (function () {
        var current = global.sortableFlatListView;
        var exports = global.sortableFlatListView = factory(global.DragAndDropActions, global.Device, global.newUniqueId, global.JIL);
        exports.noConflict = function () { global.sortableFlatListView = current; return exports; };
    }()));
}(this, (function (svelteDragAndDropActions, Device, newUniqueId, javascriptInterfaceLibrary) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var Device__default = /*#__PURE__*/_interopDefaultLegacy(Device);
    var newUniqueId__default = /*#__PURE__*/_interopDefaultLegacy(newUniqueId);

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached
        const children = target.childNodes;
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            const seqLen = upper_bound(1, longest + 1, idx => children[m[idx]].claim_order, current) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            if (node !== target.actual_end_child) {
                target.insertBefore(node, target.actual_end_child);
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append(target, node);
        }
        else if (node.parentNode !== target || (anchor && node.nextSibling !== anchor)) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function styleInject(css, ref) {
      if ( ref === void 0 ) ref = {};
      var insertAt = ref.insertAt;

      if (!css || typeof document === 'undefined') { return; }

      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      style.type = 'text/css';

      if (insertAt === 'top') {
        if (head.firstChild) {
          head.insertBefore(style, head.firstChild);
        } else {
          head.appendChild(style);
        }
      } else {
        head.appendChild(style);
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = css;
      } else {
        style.appendChild(document.createTextNode(css));
      }
    }

    var css_248z = ".defaultListView.svelte-1vn13az{display:inline-flex;flex-flow:column nowrap;position:relative;justify-content:flex-start;align-items:stretch;margin:0px;padding:0px;list-style:none}.withoutTextSelection.svelte-1vn13az{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.defaultListView.svelte-1vn13az>.ListItemView{display:block;position:relative;flex:0 0 auto;height:30px;line-height:30px;border:solid 1px transparent;margin:0px 2px 0px 2px;padding:0px 4px 0px 4px;list-style:none}.defaultListView.svelte-1vn13az>.ListItemView > *{pointer-events:none}.defaultListView.svelte-1vn13az>.ListItemView:hover:not(.dragged){border:solid 1px }.defaultListView.svelte-1vn13az>.ListItemView.selected:not(.dragged){background:dodgerblue }.defaultListView.svelte-1vn13az>.ListItemView.dragged{opacity:0.3 }.defaultListView.svelte-1vn13az>.ListItemView.hovered:not(.dragged){border-top:solid 10px transparent }.defaultListView.svelte-1vn13az>.AttachmentRegion{display:block;position:relative;flex:1 1 auto;min-height:20px;background:transparent;border:solid 1px transparent;margin:0px 2px 2px 2px;padding:0px;list-style:none}.defaultListView.svelte-1vn13az>.AttachmentRegion.hovered{border:solid 1px }.defaultListView.svelte-1vn13az>.Placeholder{display:flex;position:absolute;left:0px;top:0px;right:0px;height:100%;flex-flow:column nowrap;justify-content:center;align-items:center}";
    styleInject(css_248z,{"insertAt":"top"});

    /* src/svelte-sortable-flat-list-view.svelte generated by Svelte v3.38.3 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[63] = list[i];
    	child_ctx[65] = i;
    	return child_ctx;
    }

    const get_default_slot_changes_1 = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context_1 = ctx => ({
    	Item: /*Item*/ ctx[63],
    	Index: /*Index*/ ctx[65]
    });

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[63] = list[i];
    	child_ctx[65] = i;
    	return child_ctx;
    }

    const get_default_slot_changes = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context = ctx => ({
    	Item: /*Item*/ ctx[63],
    	Index: /*Index*/ ctx[65]
    });

    // (655:4) {:else}
    function create_else_block_1(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "";

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "Placeholder", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*Placeholder*/ 32 && raw_value !== (raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "")) li.innerHTML = raw_value;		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (647:4) {#if extendable}
    function create_if_block_3(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "";
    	let asDropZone_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "Placeholder", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = action_destroyer(asDropZone_action = svelteDragAndDropActions.asDropZone.call(null, li, {
    					Extras: { List: /*List*/ ctx[0], Item: undefined },
    					TypesToAccept: /*TypesAccepted*/ ctx[10],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    					onDroppableMove: /*onDroppableMove*/ ctx[21],
    					onDrop: /*onDrop*/ ctx[23]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*Placeholder*/ 32 && raw_value !== (raw_value = (/*Placeholder*/ ctx[5] || "(empty list)") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted*/ 1025) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[10],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    				onDroppableMove: /*onDroppableMove*/ ctx[21],
    				onDrop: /*onDrop*/ ctx[23]
    			});
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (604:2) {#if (List.length > 0)}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*sortable*/ ctx[1] || /*extendable*/ ctx[14] || /*shrinkable*/ ctx[13]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (635:4) {:else}
    function create_else_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[11](/*Item*/ ctx[63]);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*isSelected, List, handleClick, KeyOf*/ 34881 | dirty[1] & /*$$scope*/ 16384) {
    				each_value_1 = /*List*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (605:4) {#if sortable || extendable || shrinkable}
    function create_if_block_1(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t;
    	let if_block_anchor;
    	let current;
    	let each_value = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[11](/*Item*/ ctx[63]);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let if_block = (/*sortable*/ ctx[1] || /*extendable*/ ctx[14]) && create_if_block_2(ctx);

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*onlyFrom, neverFrom, dynamicDummy, List, DataOffered, onDragStart, onDragEnd, onDropped, TypesAccepted, onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave, draggedItemList, isSelected, handleClick, KeyOf*/ 16752577 | dirty[1] & /*$$scope*/ 16384) {
    				each_value = /*List*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t.parentNode, outro_and_destroy_block, create_each_block, t, get_each_context);
    				check_outros();
    			}

    			if (/*sortable*/ ctx[1] || /*extendable*/ ctx[14]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (642:31)  
    function fallback_block_1(ctx) {
    	let t_value = /*KeyOf*/ ctx[11](/*Item*/ ctx[63]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 2049 && t_value !== (t_value = /*KeyOf*/ ctx[11](/*Item*/ ctx[63]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (636:6) {#each List as Item,Index (KeyOf(Item))}
    function create_each_block_1(key_1, ctx) {
    	let li;
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[46].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[45], get_default_slot_context_1);
    	const default_slot_or_fallback = default_slot || fallback_block_1(ctx);

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[48](/*Item*/ ctx[63], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			t = space();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[63]));
    			this.first = li;
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(li, null);
    			}

    			append(li, t);
    			current = true;

    			if (!mounted) {
    				dispose = listen(li, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 16384)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[45], !current ? [-1, -1, -1] : dirty, get_default_slot_changes_1, get_default_slot_context_1);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 2049)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (dirty[0] & /*isSelected, List*/ 65) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[63]));
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (622:31)  
    function fallback_block(ctx) {
    	let t_value = /*KeyOf*/ ctx[11](/*Item*/ ctx[63]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 2049 && t_value !== (t_value = /*KeyOf*/ ctx[11](/*Item*/ ctx[63]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (606:6) {#each List as Item,Index (KeyOf(Item))}
    function create_each_block(key_1, ctx) {
    	let li;
    	let asDroppable_action;
    	let asDropZone_action;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[46].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[45], get_default_slot_context);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[47](/*Item*/ ctx[63], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "dragged", /*draggedItemList*/ ctx[12].indexOf(/*Item*/ ctx[63]) >= 0);
    			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[63]));
    			this.first = li;
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);

    			if (default_slot_or_fallback) {
    				default_slot_or_fallback.m(li, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(li, "click", click_handler),
    					action_destroyer(asDroppable_action = svelteDragAndDropActions.asDroppable.call(null, li, {
    						onlyFrom: /*onlyFrom*/ ctx[7],
    						neverFrom: /*neverFrom*/ ctx[8],
    						Dummy: /*dynamicDummy*/ ctx[16],
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[63]
    						},
    						DataToOffer: /*DataOffered*/ ctx[9],
    						onDragStart: /*onDragStart*/ ctx[17],
    						onDragEnd: /*onDragEnd*/ ctx[18],
    						onDropped: /*onDropped*/ ctx[19]
    					})),
    					action_destroyer(asDropZone_action = svelteDragAndDropActions.asDropZone.call(null, li, {
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[63]
    						},
    						TypesToAccept: /*TypesAccepted*/ ctx[10],
    						onDrop: /*onDrop*/ ctx[23],
    						onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    						onDroppableMove: /*onDroppableMove*/ ctx[21],
    						onDroppableLeave: /*onDroppableLeave*/ ctx[22]
    					}))
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 16384)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[45], !current ? [-1, -1, -1] : dirty, get_default_slot_changes, get_default_slot_context);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 2049)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (asDroppable_action && is_function(asDroppable_action.update) && dirty[0] & /*onlyFrom, neverFrom, List, DataOffered*/ 897) asDroppable_action.update.call(null, {
    				onlyFrom: /*onlyFrom*/ ctx[7],
    				neverFrom: /*neverFrom*/ ctx[8],
    				Dummy: /*dynamicDummy*/ ctx[16],
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[63]
    				},
    				DataToOffer: /*DataOffered*/ ctx[9],
    				onDragStart: /*onDragStart*/ ctx[17],
    				onDragEnd: /*onDragEnd*/ ctx[18],
    				onDropped: /*onDropped*/ ctx[19]
    			});

    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted*/ 1025) asDropZone_action.update.call(null, {
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[63]
    				},
    				TypesToAccept: /*TypesAccepted*/ ctx[10],
    				onDrop: /*onDrop*/ ctx[23],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    				onDroppableMove: /*onDroppableMove*/ ctx[21],
    				onDroppableLeave: /*onDroppableLeave*/ ctx[22]
    			});

    			if (dirty[0] & /*draggedItemList, List*/ 4097) {
    				toggle_class(li, "dragged", /*draggedItemList*/ ctx[12].indexOf(/*Item*/ ctx[63]) >= 0);
    			}

    			if (dirty[0] & /*isSelected, List*/ 65) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[63]));
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (626:6) {#if sortable || extendable}
    function create_if_block_2(ctx) {
    	let li;
    	let raw_value = (/*AttachmentRegion*/ ctx[4] || "") + "";
    	let asDropZone_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			li = element("li");
    			toggle_class(li, "AttachmentRegion", true);
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			li.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = action_destroyer(asDropZone_action = svelteDragAndDropActions.asDropZone.call(null, li, {
    					Extras: { List: /*List*/ ctx[0], Item: undefined },
    					TypesToAccept: /*TypesAccepted*/ ctx[10],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    					onDroppableMove: /*onDroppableMove*/ ctx[21],
    					onDrop: /*onDrop*/ ctx[23]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*AttachmentRegion*/ 16 && raw_value !== (raw_value = (/*AttachmentRegion*/ ctx[4] || "") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted*/ 1025) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[10],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[20],
    				onDroppableMove: /*onDroppableMove*/ ctx[21],
    				onDrop: /*onDrop*/ ctx[23]
    			});
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function create_fragment(ctx) {
    	let ul;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_if_block_3, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*List*/ ctx[0].length > 0) return 0;
    		if (/*extendable*/ ctx[14]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	let ul_levels = [
    		{ class: /*ClassNames*/ ctx[2] },
    		{ style: /*style*/ ctx[3] },
    		/*$$restProps*/ ctx[24]
    	];

    	let ul_data = {};

    	for (let i = 0; i < ul_levels.length; i += 1) {
    		ul_data = assign(ul_data, ul_levels[i]);
    	}

    	return {
    		c() {
    			ul = element("ul");
    			if_block.c();
    			set_attributes(ul, ul_data);
    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[2] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1vn13az", true);
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);
    			if_blocks[current_block_type_index].m(ul, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(ul, null);
    			}

    			set_attributes(ul, ul_data = get_spread_update(ul_levels, [
    				(!current || dirty[0] & /*ClassNames*/ 4) && { class: /*ClassNames*/ ctx[2] },
    				(!current || dirty[0] & /*style*/ 8) && { style: /*style*/ ctx[3] },
    				dirty[0] & /*$$restProps*/ 16777216 && /*$$restProps*/ ctx[24]
    			]));

    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[2] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1vn13az", true);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(ul);
    			if_blocks[current_block_type_index].d();
    		}
    	};
    }



    function instance($$self, $$props, $$invalidate) {
    	const omit_props_names = [
    		"class","style","List","Key","SelectionLimit","AttachmentRegion","Placeholder","select","selectOnly","selectAll","selectRange","deselect","deselectAll","toggleSelectionOf","selectedItems","SelectionCount","isSelected","sortable","onlyFrom","neverFrom","onSortRequest","onSort","Operations","DataToOffer","TypesToAccept","onOuterDropRequest","onDroppedOutside","onDropFromOutside"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let privateKey = newUniqueId__default['default']();
    	const dispatch = createEventDispatcher();

    	/**** common Attributes ****/
    	let { class: ClassNames = undefined } = $$props;

    	let { style = undefined } = $$props; // ...control styling
    	let { List } = $$props;
    	let { Key = undefined } = $$props;
    	let { SelectionLimit = undefined } = $$props;
    	let { AttachmentRegion = undefined } = $$props;
    	let { Placeholder = undefined } = $$props;
    	let KeyOf;

    	/**** Key Validation and quick Lookup ****/
    	let ItemSet;

    	function updateItemSet(...ArgumentsAreForReactivityOnly) {
    		ItemSet = Object.create(null);

    		List.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (ItemSet[Key] === Item) {
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"List\" contains the same item " + "multiple times");
    				} else {
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"Key\" does not produce unique keys " + "for every \"List\" item");
    				}
    			} else {
    				ItemSet[Key] = Item;
    			}
    		});
    	}

    	//----------------------------------------------------------------------------//
    	//                         Selection and Deselection                          //
    	//----------------------------------------------------------------------------//
    	let SelectionSet = new WeakMap(); // automatically "updates" on list changes

    	function select(...ItemList) {
    		let curSelectionCount = SelectionCount();

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (!SelectionSet.has(Item)) {
    					if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    						SelectionSet.set(Item, true);
    						curSelectionCount++;
    						dispatch("selected-item", Item);
    					}
    				}
    			} else {
    				javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = ItemList.length === 1 ? ItemList[0] : undefined;
    		SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function selectOnly(...ItemList) {
    		if (javascriptInterfaceLibrary.ValuesDiffer(selectedItems(), ItemList)) {
    			// not perfect...
    			deselectAll();

    			select(...ItemList);
    		} //    triggerRedraw()                                     // already done before
    	}

    	function selectAll() {
    		let curSelectionCount = SelectionCount();

    		List.forEach(Item => {
    			if (!SelectionSet.has(Item)) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(Item, true);
    					curSelectionCount++;
    					dispatch("selected-item", Item);
    				}
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	let SelectionRangeBoundaryA;
    	let SelectionRangeBoundaryB;

    	function selectRange(RangeBoundary) {
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
    		let curSelectionCount = SelectionCount();

    		for (let i = firstIndex; i <= lastIndex; i++) {
    			if (!SelectionSet.has(List[i])) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(List[i], true);
    					dispatch("selected-item", List[i]);
    				}
    			}
    		}

    		SelectionRangeBoundaryB = RangeBoundary;
    		triggerRedraw();
    	}

    	/**** deselectRange (internal only) ****/
    	function deselectRange(RangeBoundary) {
    		let IndexA = List.indexOf(SelectionRangeBoundaryA);
    		let IndexB = List.indexOf(RangeBoundary);
    		let firstIndex = Math.min(IndexA, IndexB);
    		let lastIndex = Math.max(IndexA, IndexB);

    		for (let i = firstIndex; i <= lastIndex; i++) {
    			if (SelectionSet.has(List[i])) {
    				SelectionSet.delete(List[i]);
    				dispatch("deselected-item", List[i]);
    			}
    		}
    	}

    	function deselect(...ItemList) {
    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					dispatch("deselected-item", Item);
    				}
    			} else {
    				javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to deselect " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function deselectAll() {
    		List.forEach(Item => {
    			if (SelectionSet.has(Item)) {
    				SelectionSet.delete(Item);
    				dispatch("deselected-item", Item);
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;
    		triggerRedraw();
    	}

    	function toggleSelectionOf(...ItemList) {
    		SelectionRangeBoundaryA = undefined;
    		let ItemsToBeSelected = [];

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					dispatch("deselected-item", Item);
    				} else {
    					ItemsToBeSelected.push(Item);
    				}
    			} else {
    				javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to select " + "or deselect are not part of the given \"List\"");
    			}
    		});

    		let curSelectionCount = SelectionCount();

    		if (SelectionLimit != null) {
    			let maxToBeSelected = SelectionLimit - curSelectionCount;

    			if (maxToBeSelected < ItemsToBeSelected.length) {
    				ItemsToBeSelected.length = maxToBeSelected;
    			}
    		}

    		ItemsToBeSelected.forEach(Item => {
    			SelectionSet.set(Item, true);
    			dispatch("selected-item", Item);

    			if (ItemList.length === 1) {
    				SelectionRangeBoundaryA = Item;
    				SelectionRangeBoundaryB = undefined;
    			}
    		});

    		triggerRedraw();
    	}

    	function selectedItems() {
    		let Result = List.filter(Item => SelectionSet.has(Item));
    		return Result;
    	}

    	function SelectionCount() {
    		return List.reduce((Count, Item) => Count + (SelectionSet.has(Item) ? 1 : 0), 0);
    	}

    	function isSelected(Item) {
    		return SelectionSet.has(Item);
    	}

    	/**** handleClick ****/
    	function handleClick(Event, Item) {
    		switch (true) {
    			case Event.buttons === 0 && Event.button !== 0:
    				return;
    			case Event.buttons !== 0 && Event.buttons !== 1:
    				return;
    			case Device__default['default'].PointingAccuracy === "coarse":
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
    		} // workaround
    		// ...for bug

    		Event.preventDefault();
    		Event.stopPropagation();
    	}

    	//----------------------------------------------------------------------------//
    	//                           Drag-and-Drop Handling                           //
    	//----------------------------------------------------------------------------//
    	let isDragging = false;

    	let draggedItemList = []; // needed for rendering ony
    	let { sortable = false } = $$props; // does this list view support "sorting"?
    	let { onlyFrom = undefined } = $$props;
    	let { neverFrom = undefined } = $$props;
    	let { onSortRequest = undefined } = $$props;
    	let { onSort = undefined } = $$props;
    	let { Operations = undefined } = $$props;
    	let { DataToOffer = undefined } = $$props;
    	let { TypesToAccept = undefined } = $$props;
    	let { onOuterDropRequest = undefined } = $$props;
    	let { onDroppedOutside = undefined } = $$props;
    	let { onDropFromOutside = undefined } = $$props; // returns act. accepted type (if known)
    	let DataOffered;
    	let TypesAccepted;

    	/**** parsedOperations ****/
    	function parsedOperations(Description, Argument, Default = "copy move link") {
    		let Operations = javascriptInterfaceLibrary.allowedString(Description, Argument) || Default;

    		switch (Operations.trim()) {
    			case "all":
    				return "copy move link";
    			case "none":
    				return "";
    		}

    		let OperationList = Operations.trim().replace(/\s+/g, " ").split(" ");
    		javascriptInterfaceLibrary.allowListSatisfying(Description, OperationList, Operation => javascriptInterfaceLibrary.ValueIsOneOf(Operation, svelteDragAndDropActions.DropOperations));

    		return OperationList.reduce(
    			(Result, Operation) => Result.indexOf(Operation) < 0
    			? Result + Operation + " "
    			: Result,
    			" "
    		);
    	}

    	/**** prepare for drag-and-drop ****/
    	function hasNonPrivateTypes(TypeSet) {
    		for (let Type in TypeSet) {
    			if (TypeSet.hasOwnProperty(Type) && Type !== privateKey) {
    				return true;
    			}
    		}

    		return false;
    	}

    	let shrinkable = false;
    	let extendable = false;

    	/**** ad-hoc Dummy Creation ****/
    	function dynamicDummy(DroppableExtras, Element) {
    		let auxiliaryElement = Element.cloneNode(true);
    		auxiliaryElement.style.display = "block";
    		auxiliaryElement.style.position = "absolute";
    		auxiliaryElement.style.left = document.body.scrollWidth + 100 + "px";
    		auxiliaryElement.style.width = Element.clientWidth + "px"; // not perfect
    		auxiliaryElement.style.height = Element.clientHeight + "px"; // dto.

    		if (draggedItemList.length > 1) {
    			// called after "onDragStart"
    			let Badge = document.createElement("div");

    			Badge.setAttribute("style", "display:block; position:absolute; " + "top:-10px; right:-10px; width:20px; height:20px; " + "background:red; color:white; " + "border:none; border-radius:10px; margin:0px; padding:0px 4px 0px 4px; " + "line-height:20px; text-align:center");
    			Badge.innerText = "+" + (draggedItemList.length - 1);
    			auxiliaryElement.appendChild(Badge);
    		}

    		document.body.appendChild(auxiliaryElement);

    		setTimeout(
    			() => {
    				document.body.removeChild(auxiliaryElement);
    			},
    			0
    		);

    		return auxiliaryElement;
    	}

    	/**** onDragStart ****/
    	function onDragStart(DroppableExtras) {
    		$$invalidate(44, isDragging = true);

    		if (!isSelected(DroppableExtras.Item)) {
    			selectOnly(DroppableExtras.Item);
    		}

    		$$invalidate(12, draggedItemList = DroppableExtras.ItemList = selectedItems());
    		return { x: 0, y: 0 };
    	}

    	/**** onDragEnd ****/
    	function onDragEnd(x, y, dx, dy, DroppableExtras) {
    		$$invalidate(44, isDragging = false);
    		delete DroppableExtras.ItemList;
    		$$invalidate(12, draggedItemList.length = 0, draggedItemList);
    	}

    	/**** onDropped ****/
    	function onDropped(
    		x,
    	y,
    	Operation,
    	TypeTransferred,
    	DataTransferred,
    	DropZoneExtras,
    	DroppableExtras
    	) {
    		let droppedHere = List === (DropZoneExtras && DropZoneExtras.List);

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

    				dispatch("removed-items", droppedItems.slice());
    				triggerRedraw();
    			} else {
    				try {
    					onDroppedOutside(x, y, Operation, TypeTransferred, DataTransferred, DropZoneExtras, DroppableExtras);
    				} catch(Signal) {
    					console.error("RuntimeError: callback \"onDroppedOutside\" failed", Signal);
    				} // no event to be dispatched (there is already the callback)

    				triggerRedraw(); // just to be on the safe side
    			}
    		}
    	}

    	/**** onDroppableEnter ****/
    	function onDroppableEnter(x, y, Operation, offeredTypeList, DroppableExtras, DropZoneExtras) {
    		if (List === (DroppableExtras && DroppableExtras.List) && List.indexOf(DroppableExtras.Item) >= 0 && // not a foreign item
    		DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0) {

    			triggerRedraw();
    			return false;
    		}

    		let mayBeInsertedHere = true; // because dnd-action already checked a bit

    		if (List === (DroppableExtras && DroppableExtras.List)) {
    			// own elements
    			if (sortable) {
    				if (onSortRequest != null) {
    					try {
    						mayBeInsertedHere = onSortRequest(x, y, DroppableExtras, DropZoneExtras);
    					} catch(Signal) {
    						mayBeInsertedHere = false;
    						console.error("RuntimeError: callback \"onSortRequest\" failed", Signal);
    					}
    				}
    			} else {
    				// not sortable? then own list items may not be dropped here
    				mayBeInsertedHere = false;
    			}
    		} else {
    			// foreign elements want to be dropped here
    			if (onOuterDropRequest != null) {
    				try {
    					mayBeInsertedHere = onOuterDropRequest(x, y, Operation, offeredTypeList, DroppableExtras, DroppableExtras);
    				} catch(Signal) {
    					mayBeInsertedHere = false;
    					console.error("RuntimeError: callback \"onOuterDropRequest\" failed", Signal);
    				}
    			}
    		}

    		mayBeInsertedHere ? DropZoneExtras.Item : undefined;
    		triggerRedraw();
    		return mayBeInsertedHere && Operation !== "link";
    	}

    	/**** onDroppableMove ****/
    	const onDroppableMove = onDroppableEnter;

    	/**** onDroppableLeave ****/
    	function onDroppableLeave(DroppableExtras, DropZoneExtras) {
    	} //  triggerRedraw()

    	/**** onDrop ****/
    	function onDrop(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras) {

    		if (List === (DroppableExtras && DroppableExtras.List) && List.indexOf(DroppableExtras.Item) >= 0 && // not a foreign item
    		DroppableExtras.ItemList.indexOf(DropZoneExtras.Item) >= 0) {

    			triggerRedraw();
    			return "none";
    		}

    		if (List === (DroppableExtras && DroppableExtras.List)) {
    			// own elements
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

    					dispatch("sorted-items", [droppedItems.slice(), InsertionIndex]);
    					triggerRedraw();
    				} else {
    					try {
    						onSort(DropZoneExtras.Item, droppedItems.slice());
    					} catch(Signal) {
    						console.error("RuntimeError: callback \"onSort\" failed", Signal);
    					} // no event to be dispatched (there is already the callback)

    					triggerRedraw(); // just to be on the safe side
    				}

    				return Operation; // should be 'move', but 'copy' gives better feedback
    			} else {
    				return "none";
    			}
    		} else {
    			// foreign elements want to be dropped here
    			if (onDropFromOutside == null) {
    				let ItemsToBeInserted = DroppableExtras && DroppableExtras.ItemList;

    				if (!javascriptInterfaceLibrary.ValueIsList(ItemsToBeInserted)) {
    					return "none";
    				}

    				let InsertionIndex = List.indexOf(DropZoneExtras.Item);

    				if (InsertionIndex < 0) {
    					InsertionIndex = List.length;
    				} // for "append"

    				// @ts-ignore argument list of "apply" is known to be correct
    				List.splice.apply(List, [InsertionIndex, 0].concat(ItemsToBeInserted));

    				dispatch("inserted-items", [ItemsToBeInserted.slice(), InsertionIndex]);
    				triggerRedraw();
    				return undefined; // accepted type is unknown
    			} else {
    				let acceptedType = undefined;

    				try {
    					acceptedType = onDropFromOutside(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras);
    				} catch(Signal) {
    					console.error("RuntimeError: callback \"onSort\" failed", Signal);
    				} // no event to be dispatched (there is already the callback)

    				triggerRedraw(); // just to be on the safe side
    				return acceptedType; // accepted type is unknown
    			}
    		}
    	}

    	/**** SetOfItemsIn ****/
    	function SetOfItemsIn(ItemList) {
    		let ItemSet = Object.create(null);

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);
    			ItemSet[Key] = Item;
    		});

    		return ItemSet;
    	}

    	/**** triggerRedraw ****/
    	function triggerRedraw() {
    		$$invalidate(0, List);
    	}

    	const click_handler = (Item, Event) => handleClick(Event, Item);
    	const click_handler_1 = (Item, Event) => handleClick(Event, Item);

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(24, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(2, ClassNames = $$new_props.class);
    		if ("style" in $$new_props) $$invalidate(3, style = $$new_props.style);
    		if ("List" in $$new_props) $$invalidate(0, List = $$new_props.List);
    		if ("Key" in $$new_props) $$invalidate(25, Key = $$new_props.Key);
    		if ("SelectionLimit" in $$new_props) $$invalidate(26, SelectionLimit = $$new_props.SelectionLimit);
    		if ("AttachmentRegion" in $$new_props) $$invalidate(4, AttachmentRegion = $$new_props.AttachmentRegion);
    		if ("Placeholder" in $$new_props) $$invalidate(5, Placeholder = $$new_props.Placeholder);
    		if ("sortable" in $$new_props) $$invalidate(1, sortable = $$new_props.sortable);
    		if ("onlyFrom" in $$new_props) $$invalidate(7, onlyFrom = $$new_props.onlyFrom);
    		if ("neverFrom" in $$new_props) $$invalidate(8, neverFrom = $$new_props.neverFrom);
    		if ("onSortRequest" in $$new_props) $$invalidate(36, onSortRequest = $$new_props.onSortRequest);
    		if ("onSort" in $$new_props) $$invalidate(37, onSort = $$new_props.onSort);
    		if ("Operations" in $$new_props) $$invalidate(38, Operations = $$new_props.Operations);
    		if ("DataToOffer" in $$new_props) $$invalidate(39, DataToOffer = $$new_props.DataToOffer);
    		if ("TypesToAccept" in $$new_props) $$invalidate(40, TypesToAccept = $$new_props.TypesToAccept);
    		if ("onOuterDropRequest" in $$new_props) $$invalidate(41, onOuterDropRequest = $$new_props.onOuterDropRequest);
    		if ("onDroppedOutside" in $$new_props) $$invalidate(42, onDroppedOutside = $$new_props.onDroppedOutside);
    		if ("onDropFromOutside" in $$new_props) $$invalidate(43, onDropFromOutside = $$new_props.onDropFromOutside);
    		if ("$$scope" in $$new_props) $$invalidate(45, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*ClassNames*/ 4) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"class\" attribute", ClassNames);
    		}

    		if ($$self.$$.dirty[0] & /*style*/ 8) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"style\" attribute", style);
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1) {
    			$$invalidate(0, List = javascriptInterfaceLibrary.allowedListSatisfying("\"List\" attribute", List, javascriptInterfaceLibrary.ValueIsObject) || []);
    		}

    		if ($$self.$$.dirty[0] & /*Key*/ 33554432) {
    			switch (true) {
    				case Key == null:
    					$$invalidate(11, KeyOf = Item => String(Item));
    					break;
    				case javascriptInterfaceLibrary.ValueIsNonEmptyString(Key):
    					$$invalidate(11, KeyOf = Item => String(Item[Key]));
    					break;
    				case javascriptInterfaceLibrary.ValueIsFunction(Key):
    					$$invalidate(11, KeyOf = Item => String(Key(Item)));
    					break;
    				default:
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"Key\" attribute is neither " + "a non-empty string nor a function returning such a string");
    			}
    		}

    		if ($$self.$$.dirty[0] & /*SelectionLimit*/ 67108864) {
    			javascriptInterfaceLibrary.allowOrdinal("selection limit", SelectionLimit);
    		}

    		if ($$self.$$.dirty[0] & /*AttachmentRegion*/ 16) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"AttachmentRegion\" attribute", AttachmentRegion);
    		}

    		if ($$self.$$.dirty[0] & /*Placeholder*/ 32) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"Placeholder\" attribute", Placeholder);
    		}

    		if ($$self.$$.dirty[0] & /*List, Key*/ 33554433) {
    			updateItemSet(List, Key);
    		}

    		if ($$self.$$.dirty[0] & /*SelectionLimit, List*/ 67108865) {
    			if (SelectionLimit != null && SelectionCount() > SelectionLimit) {
    				let Count = 0;

    				List.forEach(Item => {
    					if (SelectionSet.has(Item)) {
    						Count++;

    						if (Count > SelectionLimit) {
    							deselect(Item);
    						}
    					}
    				});
    			} // decreasing the selection limit with an active selection is very bad style
    		}

    		if ($$self.$$.dirty[0] & /*sortable*/ 2) {
    			$$invalidate(1, sortable = javascriptInterfaceLibrary.allowedBoolean("\"sortable\" attribute", sortable) || false);
    		}

    		if ($$self.$$.dirty[0] & /*onlyFrom*/ 128) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"onlyFrom\" CSS selector list", onlyFrom);
    		}

    		if ($$self.$$.dirty[0] & /*neverFrom*/ 256) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"neverFrom\" CSS selector list", neverFrom);
    		}

    		if ($$self.$$.dirty[1] & /*onSortRequest*/ 32) {
    			javascriptInterfaceLibrary.allowFunction("\"onSortRequest\" callback", onSortRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onSort*/ 64) {
    			javascriptInterfaceLibrary.allowFunction("\"onSort\" callback", onSort);
    		}

    		if ($$self.$$.dirty[1] & /*Operations*/ 128) {
    			parsedOperations("list of allowed operations", Operations);
    		}

    		if ($$self.$$.dirty[1] & /*DataToOffer*/ 256) {
    			javascriptInterfaceLibrary.allowPlainObject("\"DataToOffer\" attribute", DataToOffer);
    		}

    		if ($$self.$$.dirty[1] & /*TypesToAccept*/ 512) {
    			javascriptInterfaceLibrary.allowPlainObject("\"TypesToAccept\" attribute", TypesToAccept);
    		}

    		if ($$self.$$.dirty[1] & /*onOuterDropRequest*/ 1024) {
    			javascriptInterfaceLibrary.allowFunction("\"onOuterDropRequest\" callback", onOuterDropRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onDroppedOutside*/ 2048) {
    			javascriptInterfaceLibrary.allowFunction("\"onDroppedOutside\" callback", onDroppedOutside);
    		}

    		if ($$self.$$.dirty[1] & /*onDropFromOutside*/ 4096) {
    			javascriptInterfaceLibrary.allowFunction("\"onDropFromOutside\" callback", onDropFromOutside);
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, sortable*/ 514 | $$self.$$.dirty[1] & /*isDragging, DataToOffer*/ 8448) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(9, DataOffered = Object.assign({}, DataToOffer));

    				if ("none" in DataOffered) javascriptInterfaceLibrary.throwError("InvalidArgument: \"none\" is not a valid data type");

    				// @ts-ignore "DataOffered" is definitely not undefined
    				if (sortable) {
    					$$invalidate(9, DataOffered[privateKey] = "", DataOffered);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*sortable*/ 2 | $$self.$$.dirty[1] & /*isDragging, TypesToAccept*/ 8704) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(10, TypesAccepted = {});

    				if ("none" in TypesToAccept) javascriptInterfaceLibrary.throwError("InvalidArgument: \"none\" is not a valid data type");

    				for (let Type in TypesToAccept) {
    					if (TypesToAccept.hasOwnProperty(Type)) {
    						// @ts-ignore "TypesAccepted" is definitely not undefined
    						$$invalidate(10, TypesAccepted[Type] = parsedOperations("list of accepted operations for type " + javascriptInterfaceLibrary.quoted(Type), TypesToAccept[Type]), TypesAccepted);
    					}
    				}

    				// @ts-ignore "TypesAccepted" is definitely not undefined
    				if (sortable) {
    					$$invalidate(10, TypesAccepted[privateKey] = "copy move", TypesAccepted);
    				}
    			} // 'copy' because of the better visual feedback from native drag-and-drop
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, TypesAccepted*/ 1536 | $$self.$$.dirty[1] & /*isDragging*/ 8192) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(13, shrinkable = hasNonPrivateTypes(DataOffered));

    				$$invalidate(14, extendable = hasNonPrivateTypes(TypesAccepted));
    			}
    		}
    	};

    	return [
    		List,
    		sortable,
    		ClassNames,
    		style,
    		AttachmentRegion,
    		Placeholder,
    		isSelected,
    		onlyFrom,
    		neverFrom,
    		DataOffered,
    		TypesAccepted,
    		KeyOf,
    		draggedItemList,
    		shrinkable,
    		extendable,
    		handleClick,
    		dynamicDummy,
    		onDragStart,
    		onDragEnd,
    		onDropped,
    		onDroppableEnter,
    		onDroppableMove,
    		onDroppableLeave,
    		onDrop,
    		$$restProps,
    		Key,
    		SelectionLimit,
    		select,
    		selectOnly,
    		selectAll,
    		selectRange,
    		deselect,
    		deselectAll,
    		toggleSelectionOf,
    		selectedItems,
    		SelectionCount,
    		onSortRequest,
    		onSort,
    		Operations,
    		DataToOffer,
    		TypesToAccept,
    		onOuterDropRequest,
    		onDroppedOutside,
    		onDropFromOutside,
    		isDragging,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1
    	];
    }

    class Svelte_sortable_flat_list_view extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(
    			this,
    			options,
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				class: 2,
    				style: 3,
    				List: 0,
    				Key: 25,
    				SelectionLimit: 26,
    				AttachmentRegion: 4,
    				Placeholder: 5,
    				select: 27,
    				selectOnly: 28,
    				selectAll: 29,
    				selectRange: 30,
    				deselect: 31,
    				deselectAll: 32,
    				toggleSelectionOf: 33,
    				selectedItems: 34,
    				SelectionCount: 35,
    				isSelected: 6,
    				sortable: 1,
    				onlyFrom: 7,
    				neverFrom: 8,
    				onSortRequest: 36,
    				onSort: 37,
    				Operations: 38,
    				DataToOffer: 39,
    				TypesToAccept: 40,
    				onOuterDropRequest: 41,
    				onDroppedOutside: 42,
    				onDropFromOutside: 43
    			},
    			[-1, -1, -1]
    		);
    	}

    	get class() {
    		return this.$$.ctx[2];
    	}

    	set class(ClassNames) {
    		this.$set({ class: ClassNames });
    		flush();
    	}

    	get style() {
    		return this.$$.ctx[3];
    	}

    	set style(style) {
    		this.$set({ style });
    		flush();
    	}

    	get List() {
    		return this.$$.ctx[0];
    	}

    	set List(List) {
    		this.$set({ List });
    		flush();
    	}

    	get Key() {
    		return this.$$.ctx[25];
    	}

    	set Key(Key) {
    		this.$set({ Key });
    		flush();
    	}

    	get SelectionLimit() {
    		return this.$$.ctx[26];
    	}

    	set SelectionLimit(SelectionLimit) {
    		this.$set({ SelectionLimit });
    		flush();
    	}

    	get AttachmentRegion() {
    		return this.$$.ctx[4];
    	}

    	set AttachmentRegion(AttachmentRegion) {
    		this.$set({ AttachmentRegion });
    		flush();
    	}

    	get Placeholder() {
    		return this.$$.ctx[5];
    	}

    	set Placeholder(Placeholder) {
    		this.$set({ Placeholder });
    		flush();
    	}

    	get select() {
    		return this.$$.ctx[27];
    	}

    	get selectOnly() {
    		return this.$$.ctx[28];
    	}

    	get selectAll() {
    		return this.$$.ctx[29];
    	}

    	get selectRange() {
    		return this.$$.ctx[30];
    	}

    	get deselect() {
    		return this.$$.ctx[31];
    	}

    	get deselectAll() {
    		return this.$$.ctx[32];
    	}

    	get toggleSelectionOf() {
    		return this.$$.ctx[33];
    	}

    	get selectedItems() {
    		return this.$$.ctx[34];
    	}

    	get SelectionCount() {
    		return this.$$.ctx[35];
    	}

    	get isSelected() {
    		return this.$$.ctx[6];
    	}

    	get sortable() {
    		return this.$$.ctx[1];
    	}

    	set sortable(sortable) {
    		this.$set({ sortable });
    		flush();
    	}

    	get onlyFrom() {
    		return this.$$.ctx[7];
    	}

    	set onlyFrom(onlyFrom) {
    		this.$set({ onlyFrom });
    		flush();
    	}

    	get neverFrom() {
    		return this.$$.ctx[8];
    	}

    	set neverFrom(neverFrom) {
    		this.$set({ neverFrom });
    		flush();
    	}

    	get onSortRequest() {
    		return this.$$.ctx[36];
    	}

    	set onSortRequest(onSortRequest) {
    		this.$set({ onSortRequest });
    		flush();
    	}

    	get onSort() {
    		return this.$$.ctx[37];
    	}

    	set onSort(onSort) {
    		this.$set({ onSort });
    		flush();
    	}

    	get Operations() {
    		return this.$$.ctx[38];
    	}

    	set Operations(Operations) {
    		this.$set({ Operations });
    		flush();
    	}

    	get DataToOffer() {
    		return this.$$.ctx[39];
    	}

    	set DataToOffer(DataToOffer) {
    		this.$set({ DataToOffer });
    		flush();
    	}

    	get TypesToAccept() {
    		return this.$$.ctx[40];
    	}

    	set TypesToAccept(TypesToAccept) {
    		this.$set({ TypesToAccept });
    		flush();
    	}

    	get onOuterDropRequest() {
    		return this.$$.ctx[41];
    	}

    	set onOuterDropRequest(onOuterDropRequest) {
    		this.$set({ onOuterDropRequest });
    		flush();
    	}

    	get onDroppedOutside() {
    		return this.$$.ctx[42];
    	}

    	set onDroppedOutside(onDroppedOutside) {
    		this.$set({ onDroppedOutside });
    		flush();
    	}

    	get onDropFromOutside() {
    		return this.$$.ctx[43];
    	}

    	set onDropFromOutside(onDropFromOutside) {
    		this.$set({ onDropFromOutside });
    		flush();
    	}
    }

    return Svelte_sortable_flat_list_view;

})));
//# sourceMappingURL=svelte-sortable-flat-list-view.js.map
