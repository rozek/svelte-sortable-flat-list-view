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
    const identity = x => x;
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
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

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    function create_animation(node, from, fn, params) {
        if (!from)
            return noop;
        const to = node.getBoundingClientRect();
        if (from.left === to.left && from.right === to.right && from.top === to.top && from.bottom === to.bottom)
            return noop;
        const { delay = 0, duration = 300, easing = identity, 
        // @ts-ignore todo: should this be separated from destructuring? Or start/end added to public api and documentation?
        start: start_time = now() + delay, 
        // @ts-ignore todo:
        end = start_time + duration, tick = noop, css } = fn(node, { from, to }, params);
        let running = true;
        let started = false;
        let name;
        function start() {
            if (css) {
                name = create_rule(node, 0, 1, duration, delay, easing, css);
            }
            if (!delay) {
                started = true;
            }
        }
        function stop() {
            if (css)
                delete_rule(node, name);
            running = false;
        }
        loop(now => {
            if (!started && now >= start_time) {
                started = true;
            }
            if (started && now >= end) {
                tick(1, 0);
                stop();
            }
            if (!running) {
                return false;
            }
            if (started) {
                const p = now - start_time;
                const t = 0 + 1 * easing(p / duration);
                tick(t, 1 - t);
            }
            return true;
        });
        start();
        tick(0, 1);
        return stop;
    }
    function fix_position(node) {
        const style = getComputedStyle(node);
        if (style.position !== 'absolute' && style.position !== 'fixed') {
            const { width, height } = style;
            const a = node.getBoundingClientRect();
            node.style.position = 'absolute';
            node.style.width = width;
            node.style.height = height;
            add_transform(node, a);
        }
    }
    function add_transform(node, a) {
        const b = node.getBoundingClientRect();
        if (a.left !== b.left || a.top !== b.top) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            node.style.transform = `${transform} translate(${a.left - b.left}px, ${a.top - b.top}px)`;
        }
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
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
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function fix_and_outro_and_destroy_block(block, lookup) {
        block.f();
        outro_and_destroy_block(block, lookup);
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

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function flip(node, animation, params = {}) {
        const style = getComputedStyle(node);
        const transform = style.transform === 'none' ? '' : style.transform;
        const scaleX = animation.from.width / node.clientWidth;
        const scaleY = animation.from.height / node.clientHeight;
        const dx = (animation.from.left - animation.to.left) / scaleX;
        const dy = (animation.from.top - animation.to.top) / scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        const { delay = 0, duration = (d) => Math.sqrt(d) * 120, easing = cubicOut } = params;
        return {
            delay,
            duration: is_function(duration) ? duration(d) : duration,
            easing,
            css: (_t, u) => `transform: ${transform} translate(${u * dx}px, ${u * dy}px);`
        };
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

    var css_248z = ".defaultListView.svelte-1rm83g3{display:inline-flex;flex-flow:column nowrap;position:relative;justify-content:flex-start;align-items:stretch;margin:0px;padding:0px;list-style:none}.withoutTextSelection.svelte-1rm83g3{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.defaultListView.svelte-1rm83g3>.ListItemView{display:block;position:relative;flex:0 0 auto;height:30px;line-height:30px;border:solid 1px transparent;margin:0px 2px 0px 2px;padding:0px 4px 0px 4px;list-style:none}.defaultListView.svelte-1rm83g3>.ListItemView > *{pointer-events:none}.defaultListView.svelte-1rm83g3:not(.transitioning)>.ListItemView:hover:not(.dragged){border:solid 1px }.defaultListView.svelte-1rm83g3:not(.transitioning)>.ListItemView.selected:not(.dragged){background:dodgerblue }.defaultListView.svelte-1rm83g3>.ListItemView.dragged{opacity:0.3 }.defaultListView.svelte-1rm83g3>.ListItemView.hovered:not(.dragged){border-top:solid 10px transparent }.defaultListView.svelte-1rm83g3>.AttachmentRegion{display:block;position:relative;flex:1 1 auto;min-height:20px;background:transparent;border:solid 1px transparent;margin:0px 2px 2px 2px;padding:0px;list-style:none}.defaultListView.svelte-1rm83g3>.AttachmentRegion.hovered{border:solid 1px }.defaultListView.svelte-1rm83g3>.Placeholder{display:flex;position:absolute;left:0px;top:0px;right:0px;height:100%;flex-flow:column nowrap;justify-content:center;align-items:center}";
    styleInject(css_248z,{"insertAt":"top"});

    /* src/svelte-sortable-flat-list-view.svelte generated by Svelte v3.38.3 */

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[74] = list[i];
    	child_ctx[76] = i;
    	return child_ctx;
    }

    const get_default_slot_changes_1 = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context_1 = ctx => ({
    	Item: /*Item*/ ctx[74],
    	Index: /*Index*/ ctx[76]
    });

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[74] = list[i];
    	child_ctx[76] = i;
    	return child_ctx;
    }

    const get_default_slot_changes = dirty => ({
    	Item: dirty[0] & /*List*/ 1,
    	Index: dirty[0] & /*List*/ 1
    });

    const get_default_slot_context = ctx => ({
    	Item: /*Item*/ ctx[74],
    	Index: /*Index*/ ctx[76]
    });

    // (794:4) {:else}
    function create_else_block_1(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[6] || "(empty list)") + "";

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
    			if (dirty[0] & /*Placeholder*/ 64 && raw_value !== (raw_value = (/*Placeholder*/ ctx[6] || "(empty list)") + "")) li.innerHTML = raw_value;		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    // (786:4) {#if extendable}
    function create_if_block_3(ctx) {
    	let li;
    	let raw_value = (/*Placeholder*/ ctx[6] || "(empty list)") + "";
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
    					TypesToAccept: /*TypesAccepted*/ ctx[17],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    					onDroppableMove: /*onDroppableMove*/ ctx[28],
    					onDrop: /*onDrop*/ ctx[30]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*Placeholder*/ 64 && raw_value !== (raw_value = (/*Placeholder*/ ctx[6] || "(empty list)") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted*/ 131073) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[17],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    				onDroppableMove: /*onDroppableMove*/ ctx[28],
    				onDrop: /*onDrop*/ ctx[30]
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

    // (733:2) {#if (List.length > 0)}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_else_block];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*sortable*/ ctx[2] || /*extendable*/ ctx[21] || /*shrinkable*/ ctx[20]) return 0;
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

    // (771:4) {:else}
    function create_else_block(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]);

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
    			if (dirty[0] & /*withTransitions, isSelected, List, handleClick, KeyOf*/ 4227203 | dirty[1] & /*TransitionStarted, TransitionEnded, $$scope*/ 33554435) {
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

    // (734:4) {#if sortable || extendable || shrinkable}
    function create_if_block_1(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t;
    	let if_block_anchor;
    	let current;
    	let each_value = /*List*/ ctx[0];
    	const get_key = ctx => /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let if_block = (/*sortable*/ ctx[2] || /*extendable*/ ctx[21]) && create_if_block_2(ctx);

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
    			if (dirty[0] & /*withTransitions, onlyFrom, neverFrom, dynamicDummy, List, DataOffered, onDragStart, onDragEnd, onDropped, TypesAccepted, onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave, HoldDelay, onDroppableHold, ListViewElement, PanSensorWidth, PanSensorHeight, PanSpeed, draggedItemList, isSelected, handleClick, KeyOf*/ 2144337795 | dirty[1] & /*TransitionStarted, TransitionEnded, $$scope*/ 33554435) {
    				each_value = /*List*/ ctx[0];
    				group_outros();
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].r();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t.parentNode, fix_and_outro_and_destroy_block, create_each_block, t, get_each_context);
    				for (let i = 0; i < each_blocks.length; i += 1) each_blocks[i].a();
    				check_outros();
    			}

    			if (/*sortable*/ ctx[2] || /*extendable*/ ctx[21]) {
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

    // (781:31)  
    function fallback_block_1(ctx) {
    	let t_value = /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 32769 && t_value !== (t_value = /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (772:6) {#each List as Item,Index (KeyOf(Item,Index))}
    function create_each_block_1(key_1, ctx) {
    	let li;
    	let t;
    	let li_transition;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[57].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[56], get_default_slot_context_1);
    	const default_slot_or_fallback = default_slot || fallback_block_1(ctx);

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[59](/*Item*/ ctx[74], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			t = space();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "selected", /*isSelected*/ ctx[7](/*Item*/ ctx[74]));
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
    				dispose = [
    					listen(li, "click", click_handler_1),
    					listen(li, "introstart", /*TransitionStarted*/ ctx[31]),
    					listen(li, "introend", /*TransitionEnded*/ ctx[32]),
    					listen(li, "outrostart", /*TransitionStarted*/ ctx[31]),
    					listen(li, "outroend", /*TransitionEnded*/ ctx[32])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 33554432)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[56], !current ? [-1, -1, -1] : dirty, get_default_slot_changes_1, get_default_slot_context_1);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 32769)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (dirty[0] & /*isSelected, List*/ 129) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[7](/*Item*/ ctx[74]));
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(
    					li,
    					scale,
    					{
    						duration: /*withTransitions*/ ctx[1] ? 300 : 0
    					},
    					true
    				);

    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);

    			if (!li_transition) li_transition = create_bidirectional_transition(
    				li,
    				scale,
    				{
    					duration: /*withTransitions*/ ctx[1] ? 300 : 0
    				},
    				false
    			);

    			li_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (757:31)  
    function fallback_block(ctx) {
    	let t_value = /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]) + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*KeyOf, List*/ 32769 && t_value !== (t_value = /*KeyOf*/ ctx[15](/*Item*/ ctx[74], /*Index*/ ctx[76]) + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (735:6) {#each List as Item,Index (KeyOf(Item,Index))}
    function create_each_block(key_1, ctx) {
    	let li;
    	let asDroppable_action;
    	let asDropZone_action;
    	let li_transition;
    	let rect;
    	let stop_animation = noop;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[57].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[56], get_default_slot_context);
    	const default_slot_or_fallback = default_slot || fallback_block(ctx);

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[58](/*Item*/ ctx[74], ...args);
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			li = element("li");
    			if (default_slot_or_fallback) default_slot_or_fallback.c();
    			toggle_class(li, "ListItemView", true);
    			toggle_class(li, "dragged", /*draggedItemList*/ ctx[19].indexOf(/*Item*/ ctx[74]) >= 0);
    			toggle_class(li, "selected", /*isSelected*/ ctx[7](/*Item*/ ctx[74]));
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
    						onlyFrom: /*onlyFrom*/ ctx[8],
    						neverFrom: /*neverFrom*/ ctx[9],
    						Dummy: /*dynamicDummy*/ ctx[23],
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[74]
    						},
    						DataToOffer: /*DataOffered*/ ctx[16],
    						onDragStart: /*onDragStart*/ ctx[24],
    						onDragEnd: /*onDragEnd*/ ctx[25],
    						onDropped: /*onDropped*/ ctx[26]
    					})),
    					action_destroyer(asDropZone_action = svelteDragAndDropActions.asDropZone.call(null, li, {
    						Extras: {
    							List: /*List*/ ctx[0],
    							Item: /*Item*/ ctx[74]
    						},
    						TypesToAccept: /*TypesAccepted*/ ctx[17],
    						onDrop: /*onDrop*/ ctx[30],
    						onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    						onDroppableMove: /*onDroppableMove*/ ctx[28],
    						onDroppableLeave: /*onDroppableLeave*/ ctx[29],
    						HoldDelay: /*HoldDelay*/ ctx[13],
    						onDroppableHold: /*onDroppableHold*/ ctx[14],
    						Pannable: /*ListViewElement*/ ctx[18],
    						PanSensorWidth: /*PanSensorWidth*/ ctx[10],
    						PanSensorHeight: /*PanSensorHeight*/ ctx[11],
    						PanSpeed: /*PanSpeed*/ ctx[12]
    					})),
    					listen(li, "introstart", /*TransitionStarted*/ ctx[31]),
    					listen(li, "introend", /*TransitionEnded*/ ctx[32]),
    					listen(li, "outrostart", /*TransitionStarted*/ ctx[31]),
    					listen(li, "outroend", /*TransitionEnded*/ ctx[32])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 33554432)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[56], !current ? [-1, -1, -1] : dirty, get_default_slot_changes, get_default_slot_context);
    				}
    			} else {
    				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 32769)) {
    					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
    				}
    			}

    			if (asDroppable_action && is_function(asDroppable_action.update) && dirty[0] & /*onlyFrom, neverFrom, List, DataOffered*/ 66305) asDroppable_action.update.call(null, {
    				onlyFrom: /*onlyFrom*/ ctx[8],
    				neverFrom: /*neverFrom*/ ctx[9],
    				Dummy: /*dynamicDummy*/ ctx[23],
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[74]
    				},
    				DataToOffer: /*DataOffered*/ ctx[16],
    				onDragStart: /*onDragStart*/ ctx[24],
    				onDragEnd: /*onDragEnd*/ ctx[25],
    				onDropped: /*onDropped*/ ctx[26]
    			});

    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted, HoldDelay, onDroppableHold, ListViewElement, PanSensorWidth, PanSensorHeight, PanSpeed*/ 424961) asDropZone_action.update.call(null, {
    				Extras: {
    					List: /*List*/ ctx[0],
    					Item: /*Item*/ ctx[74]
    				},
    				TypesToAccept: /*TypesAccepted*/ ctx[17],
    				onDrop: /*onDrop*/ ctx[30],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    				onDroppableMove: /*onDroppableMove*/ ctx[28],
    				onDroppableLeave: /*onDroppableLeave*/ ctx[29],
    				HoldDelay: /*HoldDelay*/ ctx[13],
    				onDroppableHold: /*onDroppableHold*/ ctx[14],
    				Pannable: /*ListViewElement*/ ctx[18],
    				PanSensorWidth: /*PanSensorWidth*/ ctx[10],
    				PanSensorHeight: /*PanSensorHeight*/ ctx[11],
    				PanSpeed: /*PanSpeed*/ ctx[12]
    			});

    			if (dirty[0] & /*draggedItemList, List*/ 524289) {
    				toggle_class(li, "dragged", /*draggedItemList*/ ctx[19].indexOf(/*Item*/ ctx[74]) >= 0);
    			}

    			if (dirty[0] & /*isSelected, List*/ 129) {
    				toggle_class(li, "selected", /*isSelected*/ ctx[7](/*Item*/ ctx[74]));
    			}
    		},
    		r() {
    			rect = li.getBoundingClientRect();
    		},
    		f() {
    			fix_position(li);
    			stop_animation();
    			add_transform(li, rect);
    		},
    		a() {
    			stop_animation();
    			stop_animation = create_animation(li, rect, flip, {});
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot_or_fallback, local);

    			add_render_callback(() => {
    				if (!li_transition) li_transition = create_bidirectional_transition(
    					li,
    					scale,
    					{
    						duration: /*withTransitions*/ ctx[1] ? 300 : 0
    					},
    					true
    				);

    				li_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot_or_fallback, local);

    			if (!li_transition) li_transition = create_bidirectional_transition(
    				li,
    				scale,
    				{
    					duration: /*withTransitions*/ ctx[1] ? 300 : 0
    				},
    				false
    			);

    			li_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
    			if (detaching && li_transition) li_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (761:6) {#if sortable || extendable}
    function create_if_block_2(ctx) {
    	let li;
    	let raw_value = (/*AttachmentRegion*/ ctx[5] || "") + "";
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
    					TypesToAccept: /*TypesAccepted*/ ctx[17],
    					onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    					onDroppableMove: /*onDroppableMove*/ ctx[28],
    					onDrop: /*onDrop*/ ctx[30],
    					HoldDelay: /*HoldDelay*/ ctx[13],
    					onDroppableHold: /*onDroppableHold*/ ctx[14]
    				}));

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*AttachmentRegion*/ 32 && raw_value !== (raw_value = (/*AttachmentRegion*/ ctx[5] || "") + "")) li.innerHTML = raw_value;
    			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List, TypesAccepted, HoldDelay, onDroppableHold*/ 155649) asDropZone_action.update.call(null, {
    				Extras: { List: /*List*/ ctx[0], Item: undefined },
    				TypesToAccept: /*TypesAccepted*/ ctx[17],
    				onDroppableEnter: /*onDroppableEnter*/ ctx[27],
    				onDroppableMove: /*onDroppableMove*/ ctx[28],
    				onDrop: /*onDrop*/ ctx[30],
    				HoldDelay: /*HoldDelay*/ ctx[13],
    				onDroppableHold: /*onDroppableHold*/ ctx[14]
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
    		if (/*extendable*/ ctx[21]) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	let ul_levels = [
    		{ class: /*ClassNames*/ ctx[3] },
    		{ style: /*style*/ ctx[4] },
    		/*$$restProps*/ ctx[33]
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
    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[3] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1rm83g3", true);
    		},
    		m(target, anchor) {
    			insert(target, ul, anchor);
    			if_blocks[current_block_type_index].m(ul, null);
    			/*ul_binding*/ ctx[60](ul);
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
    				(!current || dirty[0] & /*ClassNames*/ 8) && { class: /*ClassNames*/ ctx[3] },
    				(!current || dirty[0] & /*style*/ 16) && { style: /*style*/ ctx[4] },
    				dirty[1] & /*$$restProps*/ 4 && /*$$restProps*/ ctx[33]
    			]));

    			toggle_class(ul, "defaultListView", /*ClassNames*/ ctx[3] == null);
    			toggle_class(ul, "withoutTextSelection", true);
    			toggle_class(ul, "svelte-1rm83g3", true);
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
    			/*ul_binding*/ ctx[60](null);
    		}
    	};
    }



    function scale(Element, Options) {
    	const currentStyle = window.getComputedStyle(Element);

    	const currentTransform = currentStyle.transform === "none"
    	? ""
    	: currentStyle.transform;

    	return {
    		delay: 0,
    		duration: Options.duration === 0 ? 0 : Options.duration || 300,
    		css: (t, u) => `transform: ${currentTransform} translateX(-${50 * u}%) scaleX(${t})`
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	const omit_props_names = [
    		"class","style","List","Key","AttachmentRegion","Placeholder","withTransitions","SelectionLimit","SelectionList","select","selectOnly","selectAll","selectRange","deselect","deselectAll","toggleSelectionOf","selectedItems","SelectionCount","isSelected","sortable","onlyFrom","neverFrom","onSortRequest","onSort","PanSensorWidth","PanSensorHeight","PanSpeed","Operations","DataToOffer","TypesToAccept","onOuterDropRequest","onDroppedOutside","onDropFromOutside","HoldDelay","onDroppableHold"
    	];

    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let privateKey = newUniqueId__default['default']();
    	const dispatch = createEventDispatcher();
    	let ListViewElement; // will refer to the list view's DOM element

    	/**** common Attributes ****/
    	let { class: ClassNames = undefined } = $$props;

    	let { style = undefined } = $$props; // ...control styling
    	let { List } = $$props;
    	let { Key = undefined } = $$props;
    	let { AttachmentRegion = undefined } = $$props;
    	let { Placeholder = undefined } = $$props;
    	let { withTransitions = true } = $$props;
    	let KeyOf;

    	/**** Key Validation and quick Lookup ****/
    	let ItemSet;

    	function updateItemSet(...ArgumentsAreForReactivityOnly) {
    		$$invalidate(54, ItemSet = Object.create(null));

    		List.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (ItemSet[Key] === Item) {
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"List\" contains the same item " + "multiple times");
    				} else {
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"Key\" does not produce unique keys " + "for every \"List\" item");
    				}
    			} else {
    				$$invalidate(54, ItemSet[Key] = Item, ItemSet);
    			}
    		});

    		if (ListViewElement != null) {
    			// i.e., after component was initialized
    			$$invalidate(34, SelectionList = selectedItems());
    		}
    	}

    	//----------------------------------------------------------------------------//
    	//                         Selection and Deselection                          //
    	//----------------------------------------------------------------------------//
    	let SelectionSet = new WeakMap(); // automatically "updates" on list changes

    	let { SelectionLimit = undefined } = $$props;
    	let { SelectionList = [] } = $$props;

    	function select(...ItemList) {
    		let curSelectionCount = SelectionCount(), SelectionChanged = false;

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (!SelectionSet.has(Item)) {
    					if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    						SelectionSet.set(Item, true);
    						curSelectionCount++;
    						SelectionChanged = true;
    						dispatch("selected-item", Item);
    					}
    				}
    			} else {
    				javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = ItemList.length === 1 ? ItemList[0] : undefined;
    		SelectionRangeBoundaryB = undefined;

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
    	}

    	function selectOnly(...ItemList) {
    		if (javascriptInterfaceLibrary.ValuesDiffer(selectedItems(), ItemList, "by-reference")) {
    			// not perfect...
    			deselectAll();

    			select(...ItemList);
    		} //    SelectionList = selectedItems()                     // already done before
    		//    triggerRedraw()                                                    // dto.
    	}

    	function selectAll() {
    		let curSelectionCount = SelectionCount(), SelectionChanged = false;

    		List.forEach(Item => {
    			if (!SelectionSet.has(Item)) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(Item, true);
    					curSelectionCount++;
    					SelectionChanged = true;
    					dispatch("selected-item", Item);
    				}
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
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
    		let curSelectionCount = SelectionCount(), SelectionChanged = false;

    		for (let i = firstIndex; i <= lastIndex; i++) {
    			if (!SelectionSet.has(List[i])) {
    				if (SelectionLimit == null || curSelectionCount < SelectionLimit) {
    					SelectionSet.set(List[i], true);
    					curSelectionCount++;
    					SelectionChanged = true;
    					dispatch("selected-item", List[i]);
    				}
    			}
    		}

    		SelectionRangeBoundaryB = RangeBoundary;

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
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
    				dispatch("deselected-item", List[i]);
    			}
    		}

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
    	}

    	function deselect(...ItemList) {
    		let SelectionChanged = false;

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					SelectionChanged = true;
    					dispatch("deselected-item", Item);
    				}
    			} else {
    				javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to deselect " + "are not part of the given \"List\"");
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
    	}

    	function deselectAll() {
    		let SelectionChanged = false;

    		List.forEach(Item => {
    			if (SelectionSet.has(Item)) {
    				SelectionSet.delete(Item);
    				SelectionChanged = true;
    				dispatch("deselected-item", Item);
    			}
    		});

    		SelectionRangeBoundaryA = SelectionRangeBoundaryB = undefined;

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
    	}

    	function toggleSelectionOf(...ItemList) {
    		SelectionRangeBoundaryA = undefined;
    		let ItemsToBeSelected = [], SelectionChanged = false;

    		ItemList.forEach(Item => {
    			let Key = KeyOf(Item);

    			if (Key in ItemSet) {
    				if (SelectionSet.has(Item)) {
    					SelectionSet.delete(Item);
    					SelectionChanged = true;
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
    			SelectionChanged = true;
    			dispatch("selected-item", Item);

    			if (ItemList.length === 1) {
    				SelectionRangeBoundaryA = Item;
    				SelectionRangeBoundaryB = undefined;
    			}
    		});

    		if (SelectionChanged) {
    			$$invalidate(34, SelectionList = selectedItems());
    			triggerRedraw();
    		}
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
    				if (// special handling for touch devices to feel "familiar"
    				SelectionLimit === 1 && !isSelected(Item) && !Event.ctrlKey && !Event.metaKey && !Event.shiftKey) {
    					selectOnly(Item); // workaround
    					// ...for bug

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
    	} //  Event.preventDefault()
    	//  Event.stopPropagation()

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
    	let { PanSensorWidth = undefined } = $$props;
    	let { PanSensorHeight = undefined } = $$props;
    	let { PanSpeed = undefined } = $$props;
    	let { Operations = undefined } = $$props;
    	let { DataToOffer = undefined } = $$props;
    	let { TypesToAccept = undefined } = $$props;
    	let { onOuterDropRequest = undefined } = $$props;
    	let { onDroppedOutside = undefined } = $$props;
    	let { onDropFromOutside = undefined } = $$props; // returns act. accepted type (if known)
    	let { HoldDelay = undefined } = $$props;
    	let { onDroppableHold = undefined } = $$props;
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
    		$$invalidate(55, isDragging = true);

    		if (!isSelected(DroppableExtras.Item)) {
    			selectOnly(DroppableExtras.Item);
    		}

    		$$invalidate(19, draggedItemList = DroppableExtras.ItemList = selectedItems());
    		return { x: 0, y: 0 };
    	}

    	/**** onDragEnd ****/
    	function onDragEnd(x, y, dx, dy, DroppableExtras) {
    		$$invalidate(55, isDragging = false);
    		delete DroppableExtras.ItemList;
    		$$invalidate(19, draggedItemList.length = 0, draggedItemList);
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

    	/**** TransitionStarted ****/
    	function TransitionStarted() {
    		ListViewElement.classList.add("transitioning");
    	}

    	function TransitionEnded() {
    		ListViewElement.classList.remove("transitioning");
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

    	function ul_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			ListViewElement = $$value;
    			$$invalidate(18, ListViewElement);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(33, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ("class" in $$new_props) $$invalidate(3, ClassNames = $$new_props.class);
    		if ("style" in $$new_props) $$invalidate(4, style = $$new_props.style);
    		if ("List" in $$new_props) $$invalidate(0, List = $$new_props.List);
    		if ("Key" in $$new_props) $$invalidate(35, Key = $$new_props.Key);
    		if ("AttachmentRegion" in $$new_props) $$invalidate(5, AttachmentRegion = $$new_props.AttachmentRegion);
    		if ("Placeholder" in $$new_props) $$invalidate(6, Placeholder = $$new_props.Placeholder);
    		if ("withTransitions" in $$new_props) $$invalidate(1, withTransitions = $$new_props.withTransitions);
    		if ("SelectionLimit" in $$new_props) $$invalidate(36, SelectionLimit = $$new_props.SelectionLimit);
    		if ("SelectionList" in $$new_props) $$invalidate(34, SelectionList = $$new_props.SelectionList);
    		if ("sortable" in $$new_props) $$invalidate(2, sortable = $$new_props.sortable);
    		if ("onlyFrom" in $$new_props) $$invalidate(8, onlyFrom = $$new_props.onlyFrom);
    		if ("neverFrom" in $$new_props) $$invalidate(9, neverFrom = $$new_props.neverFrom);
    		if ("onSortRequest" in $$new_props) $$invalidate(46, onSortRequest = $$new_props.onSortRequest);
    		if ("onSort" in $$new_props) $$invalidate(47, onSort = $$new_props.onSort);
    		if ("PanSensorWidth" in $$new_props) $$invalidate(10, PanSensorWidth = $$new_props.PanSensorWidth);
    		if ("PanSensorHeight" in $$new_props) $$invalidate(11, PanSensorHeight = $$new_props.PanSensorHeight);
    		if ("PanSpeed" in $$new_props) $$invalidate(12, PanSpeed = $$new_props.PanSpeed);
    		if ("Operations" in $$new_props) $$invalidate(48, Operations = $$new_props.Operations);
    		if ("DataToOffer" in $$new_props) $$invalidate(49, DataToOffer = $$new_props.DataToOffer);
    		if ("TypesToAccept" in $$new_props) $$invalidate(50, TypesToAccept = $$new_props.TypesToAccept);
    		if ("onOuterDropRequest" in $$new_props) $$invalidate(51, onOuterDropRequest = $$new_props.onOuterDropRequest);
    		if ("onDroppedOutside" in $$new_props) $$invalidate(52, onDroppedOutside = $$new_props.onDroppedOutside);
    		if ("onDropFromOutside" in $$new_props) $$invalidate(53, onDropFromOutside = $$new_props.onDropFromOutside);
    		if ("HoldDelay" in $$new_props) $$invalidate(13, HoldDelay = $$new_props.HoldDelay);
    		if ("onDroppableHold" in $$new_props) $$invalidate(14, onDroppableHold = $$new_props.onDroppableHold);
    		if ("$$scope" in $$new_props) $$invalidate(56, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*ClassNames*/ 8) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"class\" attribute", ClassNames);
    		}

    		if ($$self.$$.dirty[0] & /*style*/ 16) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"style\" attribute", style);
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1) {
    			{
    				javascriptInterfaceLibrary.allowListSatisfying("\"List\" attribute", List, javascriptInterfaceLibrary.ValueIsObject);

    				if (List == null) {
    					$$invalidate(0, List = []);
    				}
    			}
    		}

    		if ($$self.$$.dirty[1] & /*Key*/ 16) {
    			switch (true) {
    				case Key == null:
    					$$invalidate(15, KeyOf = Item => String(Item));
    					break;
    				case javascriptInterfaceLibrary.ValueIsNonEmptyString(Key):
    					$$invalidate(15, KeyOf = Item => String(Item[Key]));
    					break;
    				case javascriptInterfaceLibrary.ValueIsFunction(Key):
    					$$invalidate(15, KeyOf = (Item, Index) => String(Key(Item, Index)));
    					break;
    				default:
    					javascriptInterfaceLibrary.throwError("InvalidArgument: the given \"Key\" attribute is neither " + "a non-empty string nor a function returning such a string");
    			}
    		}

    		if ($$self.$$.dirty[0] & /*AttachmentRegion*/ 32) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"AttachmentRegion\" attribute", AttachmentRegion);
    		}

    		if ($$self.$$.dirty[0] & /*Placeholder*/ 64) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"Placeholder\" attribute", Placeholder);
    		}

    		if ($$self.$$.dirty[0] & /*withTransitions*/ 2) {
    			{
    				javascriptInterfaceLibrary.allowBoolean("\"withTransitions\" attribute", withTransitions);

    				if (withTransitions == null) {
    					$$invalidate(1, withTransitions = true);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1 | $$self.$$.dirty[1] & /*Key*/ 16) {
    			updateItemSet(List, Key);
    		}

    		if ($$self.$$.dirty[1] & /*SelectionLimit*/ 32) {
    			javascriptInterfaceLibrary.allowOrdinal("selection limit", SelectionLimit);
    		}

    		if ($$self.$$.dirty[0] & /*KeyOf, List*/ 32769 | $$self.$$.dirty[1] & /*SelectionList, ItemSet, SelectionLimit*/ 8388648) {
    			{
    				javascriptInterfaceLibrary.allowListSatisfying("\"SelectionList\" attribute", SelectionList, javascriptInterfaceLibrary.ValueIsObject);

    				if (SelectionList == null) {
    					$$invalidate(34, SelectionList = []);
    				}

    				let newSelectionSet = new WeakMap(), newSelectionCount = 0;

    				SelectionList.forEach(Item => {
    					let Key = KeyOf(Item);

    					if (Key in ItemSet) {
    						if (!newSelectionSet.has(Item)) {
    							if (SelectionLimit == null || newSelectionCount < SelectionLimit) {
    								newSelectionSet.set(Item, true);
    								newSelectionCount++;
    							}
    						}
    					} else {
    						javascriptInterfaceLibrary.throwError("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
    					}
    				});

    				let SelectionChanged = false;

    				List.forEach(Item => {
    					if (SelectionSet.has(Item)) {
    						if (!newSelectionSet.has(Item)) {
    							SelectionSet.delete(Item);
    							SelectionChanged = true;
    						}
    					} else {
    						if (newSelectionSet.has(Item)) {
    							SelectionSet.set(Item, true);
    							SelectionChanged = true;
    						}
    					}
    				});

    				if (SelectionChanged) {
    					$$invalidate(34, SelectionList = selectedItems());
    					triggerRedraw();
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*List*/ 1 | $$self.$$.dirty[1] & /*SelectionLimit*/ 32) {
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

    		if ($$self.$$.dirty[0] & /*sortable*/ 4) {
    			$$invalidate(2, sortable = javascriptInterfaceLibrary.allowedBoolean("\"sortable\" attribute", sortable) || false);
    		}

    		if ($$self.$$.dirty[0] & /*onlyFrom*/ 256) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"onlyFrom\" CSS selector list", onlyFrom);
    		}

    		if ($$self.$$.dirty[0] & /*neverFrom*/ 512) {
    			javascriptInterfaceLibrary.allowNonEmptyString("\"neverFrom\" CSS selector list", neverFrom);
    		}

    		if ($$self.$$.dirty[1] & /*onSortRequest*/ 32768) {
    			javascriptInterfaceLibrary.allowFunction("\"onSortRequest\" callback", onSortRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onSort*/ 65536) {
    			javascriptInterfaceLibrary.allowFunction("\"onSort\" callback", onSort);
    		}

    		if ($$self.$$.dirty[0] & /*PanSensorWidth*/ 1024) {
    			javascriptInterfaceLibrary.allowOrdinal("panning sensor width", PanSensorWidth);
    		}

    		if ($$self.$$.dirty[0] & /*PanSensorHeight*/ 2048) {
    			javascriptInterfaceLibrary.allowOrdinal("panning sensor height", PanSensorHeight);
    		}

    		if ($$self.$$.dirty[0] & /*PanSpeed*/ 4096) {
    			javascriptInterfaceLibrary.allowOrdinal("panning speed", PanSpeed);
    		}

    		if ($$self.$$.dirty[1] & /*Operations*/ 131072) {
    			parsedOperations("list of allowed operations", Operations);
    		}

    		if ($$self.$$.dirty[1] & /*DataToOffer*/ 262144) {
    			javascriptInterfaceLibrary.allowPlainObject("\"DataToOffer\" attribute", DataToOffer);
    		}

    		if ($$self.$$.dirty[1] & /*TypesToAccept*/ 524288) {
    			javascriptInterfaceLibrary.allowPlainObject("\"TypesToAccept\" attribute", TypesToAccept);
    		}

    		if ($$self.$$.dirty[1] & /*onOuterDropRequest*/ 1048576) {
    			javascriptInterfaceLibrary.allowFunction("\"onOuterDropRequest\" callback", onOuterDropRequest);
    		}

    		if ($$self.$$.dirty[1] & /*onDroppedOutside*/ 2097152) {
    			javascriptInterfaceLibrary.allowFunction("\"onDroppedOutside\" callback", onDroppedOutside);
    		}

    		if ($$self.$$.dirty[1] & /*onDropFromOutside*/ 4194304) {
    			javascriptInterfaceLibrary.allowFunction("\"onDropFromOutside\" callback", onDropFromOutside);
    		}

    		if ($$self.$$.dirty[0] & /*HoldDelay*/ 8192) {
    			javascriptInterfaceLibrary.allowIntegerInRange("\"HoldDelay\" attribute", HoldDelay, 0);
    		}

    		if ($$self.$$.dirty[0] & /*onDroppableHold*/ 16384) {
    			javascriptInterfaceLibrary.allowFunction("\"onDroppableHold\" callback", onDroppableHold);
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, sortable*/ 65540 | $$self.$$.dirty[1] & /*isDragging, DataToOffer*/ 17039360) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(16, DataOffered = Object.assign({}, DataToOffer));

    				if ("none" in DataOffered) javascriptInterfaceLibrary.throwError("InvalidArgument: \"none\" is not a valid data type");

    				// @ts-ignore "DataOffered" is definitely not undefined
    				if (sortable) {
    					$$invalidate(16, DataOffered[privateKey] = "", DataOffered);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*sortable*/ 4 | $$self.$$.dirty[1] & /*isDragging, TypesToAccept*/ 17301504) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(17, TypesAccepted = {});

    				if (TypesToAccept != null && "none" in TypesToAccept) javascriptInterfaceLibrary.throwError("InvalidArgument: \"none\" is not a valid data type");

    				for (let Type in TypesToAccept) {
    					if (TypesToAccept.hasOwnProperty(Type)) {
    						// @ts-ignore "TypesAccepted" is definitely not undefined
    						$$invalidate(17, TypesAccepted[Type] = parsedOperations("list of accepted operations for type " + javascriptInterfaceLibrary.quoted(Type), TypesToAccept[Type]), TypesAccepted);
    					}
    				}

    				// @ts-ignore "TypesAccepted" is definitely not undefined
    				if (sortable) {
    					$$invalidate(17, TypesAccepted[privateKey] = "copy move", TypesAccepted);
    				}
    			} // 'copy' because of the better visual feedback from native drag-and-drop
    		}

    		if ($$self.$$.dirty[0] & /*DataOffered, TypesAccepted*/ 196608 | $$self.$$.dirty[1] & /*isDragging*/ 16777216) {
    			if (!isDragging) {
    				// do not update while already dragging
    				$$invalidate(20, shrinkable = hasNonPrivateTypes(DataOffered));

    				$$invalidate(21, extendable = hasNonPrivateTypes(TypesAccepted));
    			}
    		}
    	};

    	return [
    		List,
    		withTransitions,
    		sortable,
    		ClassNames,
    		style,
    		AttachmentRegion,
    		Placeholder,
    		isSelected,
    		onlyFrom,
    		neverFrom,
    		PanSensorWidth,
    		PanSensorHeight,
    		PanSpeed,
    		HoldDelay,
    		onDroppableHold,
    		KeyOf,
    		DataOffered,
    		TypesAccepted,
    		ListViewElement,
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
    		TransitionStarted,
    		TransitionEnded,
    		$$restProps,
    		SelectionList,
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
    		ItemSet,
    		isDragging,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1,
    		ul_binding
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
    				class: 3,
    				style: 4,
    				List: 0,
    				Key: 35,
    				AttachmentRegion: 5,
    				Placeholder: 6,
    				withTransitions: 1,
    				SelectionLimit: 36,
    				SelectionList: 34,
    				select: 37,
    				selectOnly: 38,
    				selectAll: 39,
    				selectRange: 40,
    				deselect: 41,
    				deselectAll: 42,
    				toggleSelectionOf: 43,
    				selectedItems: 44,
    				SelectionCount: 45,
    				isSelected: 7,
    				sortable: 2,
    				onlyFrom: 8,
    				neverFrom: 9,
    				onSortRequest: 46,
    				onSort: 47,
    				PanSensorWidth: 10,
    				PanSensorHeight: 11,
    				PanSpeed: 12,
    				Operations: 48,
    				DataToOffer: 49,
    				TypesToAccept: 50,
    				onOuterDropRequest: 51,
    				onDroppedOutside: 52,
    				onDropFromOutside: 53,
    				HoldDelay: 13,
    				onDroppableHold: 14
    			},
    			[-1, -1, -1]
    		);
    	}

    	get class() {
    		return this.$$.ctx[3];
    	}

    	set class(ClassNames) {
    		this.$set({ class: ClassNames });
    		flush();
    	}

    	get style() {
    		return this.$$.ctx[4];
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
    		return this.$$.ctx[35];
    	}

    	set Key(Key) {
    		this.$set({ Key });
    		flush();
    	}

    	get AttachmentRegion() {
    		return this.$$.ctx[5];
    	}

    	set AttachmentRegion(AttachmentRegion) {
    		this.$set({ AttachmentRegion });
    		flush();
    	}

    	get Placeholder() {
    		return this.$$.ctx[6];
    	}

    	set Placeholder(Placeholder) {
    		this.$set({ Placeholder });
    		flush();
    	}

    	get withTransitions() {
    		return this.$$.ctx[1];
    	}

    	set withTransitions(withTransitions) {
    		this.$set({ withTransitions });
    		flush();
    	}

    	get SelectionLimit() {
    		return this.$$.ctx[36];
    	}

    	set SelectionLimit(SelectionLimit) {
    		this.$set({ SelectionLimit });
    		flush();
    	}

    	get SelectionList() {
    		return this.$$.ctx[34];
    	}

    	set SelectionList(SelectionList) {
    		this.$set({ SelectionList });
    		flush();
    	}

    	get select() {
    		return this.$$.ctx[37];
    	}

    	get selectOnly() {
    		return this.$$.ctx[38];
    	}

    	get selectAll() {
    		return this.$$.ctx[39];
    	}

    	get selectRange() {
    		return this.$$.ctx[40];
    	}

    	get deselect() {
    		return this.$$.ctx[41];
    	}

    	get deselectAll() {
    		return this.$$.ctx[42];
    	}

    	get toggleSelectionOf() {
    		return this.$$.ctx[43];
    	}

    	get selectedItems() {
    		return this.$$.ctx[44];
    	}

    	get SelectionCount() {
    		return this.$$.ctx[45];
    	}

    	get isSelected() {
    		return this.$$.ctx[7];
    	}

    	get sortable() {
    		return this.$$.ctx[2];
    	}

    	set sortable(sortable) {
    		this.$set({ sortable });
    		flush();
    	}

    	get onlyFrom() {
    		return this.$$.ctx[8];
    	}

    	set onlyFrom(onlyFrom) {
    		this.$set({ onlyFrom });
    		flush();
    	}

    	get neverFrom() {
    		return this.$$.ctx[9];
    	}

    	set neverFrom(neverFrom) {
    		this.$set({ neverFrom });
    		flush();
    	}

    	get onSortRequest() {
    		return this.$$.ctx[46];
    	}

    	set onSortRequest(onSortRequest) {
    		this.$set({ onSortRequest });
    		flush();
    	}

    	get onSort() {
    		return this.$$.ctx[47];
    	}

    	set onSort(onSort) {
    		this.$set({ onSort });
    		flush();
    	}

    	get PanSensorWidth() {
    		return this.$$.ctx[10];
    	}

    	set PanSensorWidth(PanSensorWidth) {
    		this.$set({ PanSensorWidth });
    		flush();
    	}

    	get PanSensorHeight() {
    		return this.$$.ctx[11];
    	}

    	set PanSensorHeight(PanSensorHeight) {
    		this.$set({ PanSensorHeight });
    		flush();
    	}

    	get PanSpeed() {
    		return this.$$.ctx[12];
    	}

    	set PanSpeed(PanSpeed) {
    		this.$set({ PanSpeed });
    		flush();
    	}

    	get Operations() {
    		return this.$$.ctx[48];
    	}

    	set Operations(Operations) {
    		this.$set({ Operations });
    		flush();
    	}

    	get DataToOffer() {
    		return this.$$.ctx[49];
    	}

    	set DataToOffer(DataToOffer) {
    		this.$set({ DataToOffer });
    		flush();
    	}

    	get TypesToAccept() {
    		return this.$$.ctx[50];
    	}

    	set TypesToAccept(TypesToAccept) {
    		this.$set({ TypesToAccept });
    		flush();
    	}

    	get onOuterDropRequest() {
    		return this.$$.ctx[51];
    	}

    	set onOuterDropRequest(onOuterDropRequest) {
    		this.$set({ onOuterDropRequest });
    		flush();
    	}

    	get onDroppedOutside() {
    		return this.$$.ctx[52];
    	}

    	set onDroppedOutside(onDroppedOutside) {
    		this.$set({ onDroppedOutside });
    		flush();
    	}

    	get onDropFromOutside() {
    		return this.$$.ctx[53];
    	}

    	set onDropFromOutside(onDropFromOutside) {
    		this.$set({ onDropFromOutside });
    		flush();
    	}

    	get HoldDelay() {
    		return this.$$.ctx[13];
    	}

    	set HoldDelay(HoldDelay) {
    		this.$set({ HoldDelay });
    		flush();
    	}

    	get onDroppableHold() {
    		return this.$$.ctx[14];
    	}

    	set onDroppableHold(onDroppableHold) {
    		this.$set({ onDroppableHold });
    		flush();
    	}
    }

    return Svelte_sortable_flat_list_view;

})));
//# sourceMappingURL=svelte-sortable-flat-list-view.js.map
