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

//----------------------------------------------------------------------------//
/**** throwError - simplifies construction of named errors ****/
function throwError$1(Message) {
    var Match = /^([$a-zA-Z][$a-zA-Z0-9]*):\s*(\S.+)\s*$/.exec(Message);
    if (Match == null) {
        throw new Error(Message);
    }
    else {
        var namedError = new Error(Match[2]);
        namedError.name = Match[1];
        throw namedError;
    }
}
/**** ValueIsBoolean ****/
function ValueIsBoolean(Value) {
    return (typeof Value === 'boolean') || (Value instanceof Boolean);
}
/**** ValueIsString ****/
function ValueIsString$1(Value) {
    return (typeof Value === 'string') || (Value instanceof String);
}
/**** ValueIsNonEmptyString ****/
var emptyStringPattern$1 = /^\s*$/;
function ValueIsNonEmptyString$1(Value) {
    return ((typeof Value === 'string') || (Value instanceof String)) && !emptyStringPattern$1.test(Value.valueOf());
}
/**** ValueIsFunction ****/
function ValueIsFunction$1(Value) {
    return (typeof Value === 'function');
}
/**** ValueIsObject ****/
function ValueIsObject$1(Value) {
    return (Value != null) && (typeof Value === 'object');
}
/**** ValueIsPlainObject ****/
function ValueIsPlainObject$1(Value) {
    return ((Value != null) && (typeof Value === 'object') &&
        (Object.getPrototypeOf(Value) === Object.prototype));
}
/**** ValueIsArray ****/
var ValueIsArray$1 = Array.isArray;
/**** ValueIsList ("dense" array) ****/
function ValueIsList(Value, minLength, maxLength) {
    if (ValueIsArray$1(Value)) {
        for (var i = 0, l = Value.length; i < l; i++) {
            if (Value[i] === undefined) {
                return false;
            }
        }
        if (minLength != null) {
            if (Value.length < minLength) {
                return false;
            }
        }
        if (maxLength != null) {
            if (Value.length > maxLength) {
                return false;
            }
        }
        return true;
    }
    return false;
}
/**** ValueIsListSatisfying ****/
function ValueIsListSatisfying$1(Value, Validator, minLength, maxLength) {
    if (ValueIsArray$1(Value)) {
        try {
            for (var i = 0, l = Value.length; i < l; i++) {
                if (Validator(Value[i]) == false) {
                    return false;
                }
            }
            if (minLength != null) {
                if (Value.length < minLength) {
                    return false;
                }
            }
            if (maxLength != null) {
                if (Value.length > maxLength) {
                    return false;
                }
            }
            return true;
        }
        catch (Signal) { /* nop */ }
    }
    return false;
}
/**** ValueIsOneOf ****/
function ValueIsOneOf$1(Value, ValueList) {
    return (ValueList.indexOf(Value) >= 0);
} // no automatic unboxing of boxed values and vice-versa!
var acceptNil$1 = true;
/**** validatedArgument ****/
function validatedArgument$1(Description, Argument, ValueIsValid, NilIsAcceptable, Expectation) {
    if (Argument == null) {
        if (NilIsAcceptable) {
            return Argument;
        }
        else {
            throwError$1("MissingArgument: no " + escaped$1(Description) + " given");
        }
    }
    else {
        if (ValueIsValid(Argument)) {
            switch (true) {
                case Argument instanceof Boolean:
                case Argument instanceof Number:
                case Argument instanceof String:
                    return Argument.valueOf(); // unboxes any primitives
                default:
                    return Argument;
            }
        }
        else {
            throwError$1("InvalidArgument: the given " + escaped$1(Description) + " is no valid " + escaped$1(Expectation));
        }
    }
}
/**** ValidatorForClassifier ****/
function ValidatorForClassifier$1(Classifier, NilIsAcceptable, Expectation) {
    var Validator = function (Description, Argument) {
        return validatedArgument$1(Description, Argument, Classifier, NilIsAcceptable, Expectation);
    };
    var ClassifierName = Classifier.name;
    if ((ClassifierName != null) && /^ValueIs/.test(ClassifierName)) {
        var ValidatorName = ClassifierName.replace(// derive name from validator
        /^ValueIs/, NilIsAcceptable ? 'allow' : 'expect');
        return FunctionWithName$1(Validator, ValidatorName);
    }
    else {
        return Validator; // without any specific name
    }
}
/**** FunctionWithName (works with older JS engines as well) ****/
function FunctionWithName$1(originalFunction, desiredName) {
    if (originalFunction == null) {
        throwError$1('MissingArgument: no function given');
    }
    if (typeof originalFunction !== 'function') {
        throwError$1('InvalidArgument: the given 1st Argument is not a JavaScript function');
    }
    if (desiredName == null) {
        throwError$1('MissingArgument: no desired name given');
    }
    if ((typeof desiredName !== 'string') && !(desiredName instanceof String)) {
        throwError$1('InvalidArgument: the given desired name is not a string');
    }
    if (originalFunction.name === desiredName) {
        return originalFunction;
    }
    try {
        Object.defineProperty(originalFunction, 'name', { value: desiredName });
        if (originalFunction.name === desiredName) {
            return originalFunction;
        }
    }
    catch (signal) { /* ok - let's take the hard way */ }
    var renamed = new Function('originalFunction', 'return function ' + desiredName + ' () {' +
        'return originalFunction.apply(this,Array.prototype.slice.apply(arguments))' +
        '}');
    return renamed(originalFunction);
} // also works with older JavaScript engines
/**** allow/expect[ed]Boolean ****/
var allowBoolean = /*#__PURE__*/ ValidatorForClassifier$1(ValueIsBoolean, acceptNil$1, 'boolean value'), allowedBoolean = allowBoolean;
/**** allow/expect[ed]String ****/
var allowString$1 = /*#__PURE__*/ ValidatorForClassifier$1(ValueIsString$1, acceptNil$1, 'literal string'), allowedString$1 = allowString$1;
/**** allow/expect[ed]NonEmptyString ****/
var allowNonEmptyString$1 = /*#__PURE__*/ ValidatorForClassifier$1(ValueIsNonEmptyString$1, acceptNil$1, 'non-empty literal string'), allowedNonEmptyString$1 = allowNonEmptyString$1;
/**** allow/expect[ed]Function ****/
var allowFunction$1 = /*#__PURE__*/ ValidatorForClassifier$1(ValueIsFunction$1, acceptNil$1, 'JavaScript function');
/**** allow/expect[ed]PlainObject ****/
var allowPlainObject$1 = /*#__PURE__*/ ValidatorForClassifier$1(ValueIsPlainObject$1, acceptNil$1, '"plain" JavaScript object');
/**** allow[ed]ListSatisfying ****/
function allowListSatisfying$1(Description, Argument, Validator, Expectation, minLength, maxLength) {
    return (Argument == null
        ? Argument
        : expectedListSatisfying$1(Description, Argument, Validator, Expectation, minLength, maxLength));
}
var allowedListSatisfying = allowListSatisfying$1;
/**** expect[ed]ListSatisfying ****/
function expectListSatisfying$1(Description, Argument, Validator, Expectation, minLength, maxLength) {
    if (Argument == null) {
        throwError$1("MissingArgument: no " + escaped$1(Description) + " given");
    }
    if (ValueIsListSatisfying$1(Argument, Validator, minLength, maxLength)) {
        return Argument;
    }
    else {
        throwError$1("InvalidArgument: the given " + escaped$1(Description) + " is " + (Expectation == null
            ? 'either not a list or contains invalid elements'
            : 'no ' + escaped$1(Expectation)));
    }
}
var expectedListSatisfying$1 = expectListSatisfying$1;
/**** escaped - escapes all control characters in a given string ****/
function escaped$1(Text) {
    var EscapeSequencePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?/g;
    var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
    return Text
        .replace(EscapeSequencePattern, function (Match) {
        return (Match === '\\' ? '\\\\' : Match);
    })
        .replace(CtrlCharCodePattern, function (Match) {
        switch (Match) {
            case '\0': return '\\0';
            case '\b': return '\\b';
            case '\f': return '\\f';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\v': return '\\v';
            default: {
                var HexCode = Match.charCodeAt(0).toString(16);
                return '\\x' + '00'.slice(HexCode.length) + HexCode;
            }
        }
    });
}
/**** quotable - makes a given string ready to be put in single/double quotes ****/
function quotable$1(Text, Quote) {
    if (Quote === void 0) { Quote = '"'; }
    var EscSeqOrSglQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|'/g;
    var EscSeqOrDblQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|"/g;
    var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
    return Text
        .replace(Quote === "'" ? EscSeqOrSglQuotePattern : EscSeqOrDblQuotePattern, function (Match) {
        switch (Match) {
            case "'": return "\\'";
            case '"': return '\\"';
            case '\\': return '\\\\';
            default: return Match;
        }
    })
        .replace(CtrlCharCodePattern, function (Match) {
        switch (Match) {
            case '\0': return '\\0';
            case '\b': return '\\b';
            case '\f': return '\\f';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\v': return '\\v';
            default: {
                var HexCode = Match.charCodeAt(0).toString(16);
                return '\\x' + '00'.slice(HexCode.length) + HexCode;
            }
        }
    });
}
/**** quoted ****/
function quoted$1(Text, Quote) {
    if (Quote === void 0) { Quote = '"'; }
    return Quote + quotable$1(Text, Quote) + Quote;
}

var e$1,n=!1;e$1=navigator.userAgent||navigator.vendor||window.opera,(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(e$1)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(e$1.substr(0,4)))&&(n=!0);var i=!1;if(n){var t$1=window.innerWidth,a=window.innerHeight,o=Math.min(t$1,a),r$1=Math.max(t$1,a);i=o<=480&&r$1<=896;}var c=window.matchMedia||window.webkitMatchmedia||window.mozMatchmedia||window.oMatchmedia;function d(e){return null!=c&&c(e).matches}function s(){return "interactive"===document.readyState||"complete"===document.readyState}var l,m=!d("(pointer:fine)")&&!d("(pointer:coarse)")&&!d("-moz-touch-enabled")&&("ontouchstart"in Window||(navigator.maxTouchPoints||0)>0||/touch|android|iphone|ipod|ipad/i.test(navigator.userAgent));function u(){var e="fine";switch(!0){case d("(pointer:none)"):e="none";break;case d("(pointer:coarse)"):case d("-moz-touch-enabled"):case m:e="coarse";}if(l=e,s())switch(document.body.classList.remove("noPointer","finePointer","coarsePointer"),e){case"none":document.body.classList.add("noPointer");break;case"fine":document.body.classList.add("finePointer");break;case"coarse":document.body.classList.add("coarsePointer");}}u(),s()||window.addEventListener("DOMContentLoaded",u);var p=[];function h(e,n){if("function"!=typeof e)throw new Error("handler function expected");for(var i=0,t=p.length;i<t;i++)if(p[i].Handler===e)return void(p[i].onceOnly=n);p.push({Handler:e,onceOnly:n}),1===p.length&&(v=setInterval((function(){var e=l;u(),l!==e&&function(){for(var e=0,n=p.length;e<n;e++){var i=p[e],t=i.Handler,a=i.onceOnly;try{t(l);}catch(e){console.warn("PointingAccuracy observation function failed with",e);}a&&g(t);}}();}),500));}function g(e){for(var n=0,i=p.length;n<i;n++)if(p[n].Handler===e){p.splice(n,1);break}0===p.length&&(clearInterval(v),v=void 0);}var v=void 0;function w(e,n){return "function"==typeof e.item?e.item(n):e[n]}function f(e,n){for(var i=0,t=e.length;i<t;i++)if(n.test(w(e,i)))return !0;return !1}if(m){for(var b=document.styleSheets,y=0,k=b.length;y<k;y++)for(var x=b[y].cssRules||b[y].rules,P=0,z=x.length;P<z;P++){var A=x[P];if(A.type===CSSRule.MEDIA_RULE&&f(A.media,/handheld/i)){var M=A.media;M.mediaText=M.mediaText.replace("handheld","screen");}}var L=document.getElementsByTagName("link");for(y=0,k=L.length;y<k;y++){var T=L[y];/handheld/i.test(T.media)&&(T.media=T.media.replace("handheld","screen"));}}var j={get isMobile(){return n},get isPhone(){return i},get isTablet(){return n&&!i},get isLegacyTouchDevice(){return m},get PointingAccuracy(){return l},onPointingAccuracyChanged:function(e){h(e,!1);},oncePointingAccuracyChanged:function(e){h(e,!0);},offPointingAccuracyChanged:function(e){g(e);},get observesPointingAccuracy(){return null!=v}};

var r=0;function t(){return "uid-"+ ++r}

//----------------------------------------------------------------------------//
// see https://stackoverflow.com/questions/3277182/how-to-get-the-global-object-in-javascript
//------------------------------------------------------------------------------
//--                             Object Functions                             --
//------------------------------------------------------------------------------
// allow methods from Object.prototype to be applied to "vanilla" objects
/**** Object_hasOwnProperty ****/
function Object_hasOwnProperty(Value, PropertyName) {
    return ((Value == null) || // let this method crash like its original
        ('hasOwnProperty' in Value) && (typeof Value.hasOwnProperty === 'function')
        ? Value.hasOwnProperty(PropertyName)
        : Object.prototype.hasOwnProperty.call(Value, PropertyName));
}
/**** throwError - simplifies construction of named errors ****/
function throwError(Message) {
    var Match = /^([$a-zA-Z][$a-zA-Z0-9]*):\s*(\S.+)\s*$/.exec(Message);
    if (Match == null) {
        throw new Error(Message);
    }
    else {
        var namedError = new Error(Match[2]);
        namedError.name = Match[1];
        throw namedError;
    }
}
/**** ValueIsFiniteNumber (pure "isFinite" breaks on objects) ****/
function ValueIsFiniteNumber(Value) {
    return ((typeof Value === 'number') || (Value instanceof Number)) && isFinite(Value.valueOf());
}
/**** ValueIsInteger ****/
function ValueIsInteger(Value) {
    if ((typeof Value !== 'number') && !(Value instanceof Number)) {
        return false;
    }
    Value = Value.valueOf();
    return isFinite(Value) && (Math.round(Value) === Value);
}
/**** ValueIsString ****/
function ValueIsString(Value) {
    return (typeof Value === 'string') || (Value instanceof String);
}
/**** ValueIsNonEmptyString ****/
var emptyStringPattern = /^\s*$/;
function ValueIsNonEmptyString(Value) {
    return ((typeof Value === 'string') || (Value instanceof String)) && !emptyStringPattern.test(Value.valueOf());
}
/**** ValueIsFunction ****/
function ValueIsFunction(Value) {
    return (typeof Value === 'function');
}
/**** ValueIsObject ****/
function ValueIsObject(Value) {
    return (Value != null) && (typeof Value === 'object');
}
/**** ValueIsPlainObject ****/
function ValueIsPlainObject(Value) {
    return ((Value != null) && (typeof Value === 'object') &&
        (Object.getPrototypeOf(Value) === Object.prototype));
}
/**** ValueIsArray ****/
var ValueIsArray = Array.isArray;
/**** ValueIsListSatisfying ****/
function ValueIsListSatisfying(Value, Validator, minLength, maxLength) {
    if (ValueIsArray(Value)) {
        try {
            for (var i = 0, l = Value.length; i < l; i++) {
                if (Validator(Value[i]) == false) {
                    return false;
                }
            }
            if (minLength != null) {
                if (Value.length < minLength) {
                    return false;
                }
            }
            if (maxLength != null) {
                if (Value.length > maxLength) {
                    return false;
                }
            }
            return true;
        }
        catch (Signal) { /* nop */ }
    }
    return false;
}
/**** ValueIsOneOf ****/
function ValueIsOneOf(Value, ValueList) {
    return (ValueList.indexOf(Value) >= 0);
} // no automatic unboxing of boxed values and vice-versa!
//------------------------------------------------------------------------------
//--                      Argument Validation Functions                       --
//------------------------------------------------------------------------------
var rejectNil = false;
var acceptNil = true;
/**** validatedArgument ****/
function validatedArgument(Description, Argument, ValueIsValid, NilIsAcceptable, Expectation) {
    if (Argument == null) {
        if (NilIsAcceptable) {
            return Argument;
        }
        else {
            throwError("MissingArgument: no " + escaped(Description) + " given");
        }
    }
    else {
        if (ValueIsValid(Argument)) {
            switch (true) {
                case Argument instanceof Boolean:
                case Argument instanceof Number:
                case Argument instanceof String:
                    return Argument.valueOf(); // unboxes any primitives
                default:
                    return Argument;
            }
        }
        else {
            throwError("InvalidArgument: the given " + escaped(Description) + " is no valid " + escaped(Expectation));
        }
    }
}
/**** ValidatorForClassifier ****/
function ValidatorForClassifier(Classifier, NilIsAcceptable, Expectation) {
    var Validator = function (Description, Argument) {
        return validatedArgument(Description, Argument, Classifier, NilIsAcceptable, Expectation);
    };
    var ClassifierName = Classifier.name;
    if ((ClassifierName != null) && /^ValueIs/.test(ClassifierName)) {
        var ValidatorName = ClassifierName.replace(// derive name from validator
        /^ValueIs/, NilIsAcceptable ? 'allow' : 'expect');
        return FunctionWithName(Validator, ValidatorName);
    }
    else {
        return Validator; // without any specific name
    }
}
/**** FunctionWithName (works with older JS engines as well) ****/
function FunctionWithName(originalFunction, desiredName) {
    if (originalFunction == null) {
        throwError('MissingArgument: no function given');
    }
    if (typeof originalFunction !== 'function') {
        throwError('InvalidArgument: the given 1st Argument is not a JavaScript function');
    }
    if (desiredName == null) {
        throwError('MissingArgument: no desired name given');
    }
    if ((typeof desiredName !== 'string') && !(desiredName instanceof String)) {
        throwError('InvalidArgument: the given desired name is not a string');
    }
    if (originalFunction.name === desiredName) {
        return originalFunction;
    }
    try {
        Object.defineProperty(originalFunction, 'name', { value: desiredName });
        if (originalFunction.name === desiredName) {
            return originalFunction;
        }
    }
    catch (signal) { /* ok - let's take the hard way */ }
    var renamed = new Function('originalFunction', 'return function ' + desiredName + ' () {' +
        'return originalFunction.apply(this,Array.prototype.slice.apply(arguments))' +
        '}');
    return renamed(originalFunction);
} // also works with older JavaScript engines
/**** allow/expect[ed]FiniteNumber ****/
var allowFiniteNumber = /*#__PURE__*/ ValidatorForClassifier(ValueIsFiniteNumber, acceptNil, 'finite numeric value'), allowedFiniteNumber = allowFiniteNumber;
var expectInteger = /*#__PURE__*/ ValidatorForClassifier(ValueIsInteger, rejectNil, 'integral numeric value');
/**** allow[ed]IntegerInRange ****/
function allowIntegerInRange(Description, Argument, minValue, maxValue) {
    return (Argument == null
        ? Argument
        : expectedIntegerInRange(Description, Argument, minValue, maxValue));
}
var allowedIntegerInRange = allowIntegerInRange;
/**** expect[ed]IntegerInRange ****/
function expectIntegerInRange(Description, Argument, minValue, maxValue) {
    expectInteger(Description, Argument);
    if (isNaN(Argument)) {
        throwError("InvalidArgument: the given " + escaped(Description) + " is not-a-number");
    }
    if ((minValue != null) && isFinite(minValue)) {
        if ((maxValue != null) && isFinite(maxValue)) {
            if ((Argument < minValue) || (Argument > maxValue)) {
                throw new RangeError("the given " + escaped(Description) + " (" + Argument + ") is outside " +
                    ("the allowed range (" + minValue + "..." + maxValue + ")"));
            }
        }
        else {
            if (Argument < minValue) {
                throw new RangeError("the given " + escaped(Description) + " is below the allowed " +
                    ("minimum (" + Argument + " < " + minValue + ")"));
            }
        }
    }
    else {
        if ((maxValue != null) && isFinite(maxValue)) {
            if (Argument > maxValue) {
                throw new RangeError("the given " + escaped(Description) + " exceeds the allowed " +
                    ("maximum (" + Argument + " > " + maxValue + ")"));
            }
        }
    }
    return Argument.valueOf();
}
var expectedIntegerInRange = expectIntegerInRange;
/**** allow/expect[ed]String ****/
var allowString = /*#__PURE__*/ ValidatorForClassifier(ValueIsString, acceptNil, 'literal string'), allowedString = allowString;
/**** allow/expect[ed]NonEmptyString ****/
var allowNonEmptyString = /*#__PURE__*/ ValidatorForClassifier(ValueIsNonEmptyString, acceptNil, 'non-empty literal string'), allowedNonEmptyString = allowNonEmptyString;
/**** allow/expect[ed]Function ****/
var allowFunction = /*#__PURE__*/ ValidatorForClassifier(ValueIsFunction, acceptNil, 'JavaScript function'), allowedFunction = allowFunction;
var expectObject = /*#__PURE__*/ ValidatorForClassifier(ValueIsObject, rejectNil, 'JavaScript object');
/**** allow/expect[ed]PlainObject ****/
var allowPlainObject = /*#__PURE__*/ ValidatorForClassifier(ValueIsPlainObject, acceptNil, '"plain" JavaScript object'), allowedPlainObject = allowPlainObject;
/**** allow[ed]ListSatisfying ****/
function allowListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength) {
    return (Argument == null
        ? Argument
        : expectedListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength));
}
/**** expect[ed]ListSatisfying ****/
function expectListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength) {
    if (Argument == null) {
        throwError("MissingArgument: no " + escaped(Description) + " given");
    }
    if (ValueIsListSatisfying(Argument, Validator, minLength, maxLength)) {
        return Argument;
    }
    else {
        throwError("InvalidArgument: the given " + escaped(Description) + " is " + (Expectation == null
            ? 'either not a list or contains invalid elements'
            : 'no ' + escaped(Expectation)));
    }
}
var expectedListSatisfying = expectListSatisfying;
/**** escaped - escapes all control characters in a given string ****/
function escaped(Text) {
    var EscapeSequencePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?/g;
    var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
    return Text
        .replace(EscapeSequencePattern, function (Match) {
        return (Match === '\\' ? '\\\\' : Match);
    })
        .replace(CtrlCharCodePattern, function (Match) {
        switch (Match) {
            case '\0': return '\\0';
            case '\b': return '\\b';
            case '\f': return '\\f';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\v': return '\\v';
            default: {
                var HexCode = Match.charCodeAt(0).toString(16);
                return '\\x' + '00'.slice(HexCode.length) + HexCode;
            }
        }
    });
}
/**** quotable - makes a given string ready to be put in single/double quotes ****/
function quotable(Text, Quote) {
    if (Quote === void 0) { Quote = '"'; }
    var EscSeqOrSglQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|'/g;
    var EscSeqOrDblQuotePattern = /\\x[0-9a-zA-Z]{2}|\\u[0-9a-zA-Z]{4}|\\[0bfnrtv'"\\\/]?|"/g;
    var CtrlCharCodePattern = /[\x00-\x1f\x7f-\x9f]/g;
    return Text
        .replace(Quote === "'" ? EscSeqOrSglQuotePattern : EscSeqOrDblQuotePattern, function (Match) {
        switch (Match) {
            case "'": return "\\'";
            case '"': return '\\"';
            case '\\': return '\\\\';
            default: return Match;
        }
    })
        .replace(CtrlCharCodePattern, function (Match) {
        switch (Match) {
            case '\0': return '\\0';
            case '\b': return '\\b';
            case '\f': return '\\f';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\t': return '\\t';
            case '\v': return '\\v';
            default: {
                var HexCode = Match.charCodeAt(0).toString(16);
                return '\\x' + '00'.slice(HexCode.length) + HexCode;
            }
        }
    });
}
/**** quoted ****/
function quoted(Text, Quote) {
    if (Quote === void 0) { Quote = '"'; }
    return Quote + quotable(Text, Quote) + Quote;
}
/**** ObjectIsEmpty ****/
function ObjectIsEmpty(Candidate) {
    expectObject('candidate', Candidate);
    for (var Key in Candidate) {
        if (Object_hasOwnProperty(Candidate, Key)) {
            return false;
        }
    }
    return true;
}
/**** ObjectIsNotEmpty ****/
function ObjectIsNotEmpty(Candidate) {
    return !ObjectIsEmpty(Candidate);
}
/**** constrained ****/
function constrained(Value, Minimum, Maximum) {
    if (Minimum === void 0) { Minimum = -Infinity; }
    if (Maximum === void 0) { Maximum = Infinity; }
    return Math.max(Minimum, Math.min(Value, Maximum));
}

var e={fromViewportTo:function(e,t,o){switch(!0){case null==t:throw new Error('no "Position" given');case"number"!=typeof t.left&&!(t.left instanceof Number):case"number"!=typeof t.top&&!(t.top instanceof Number):throw new Error('invalid "Position" given')}switch(e){case null:case void 0:throw new Error("no coordinate system given");case"viewport":return {left:t.left,top:t.top};case"document":return {left:t.left+window.scrollX,top:t.top+window.scrollY};case"local":switch(!0){case null==o:throw new Error("no target element given");case o instanceof Element:var r=window.getComputedStyle(o),n=parseFloat(r.borderLeftWidth),i=parseFloat(r.borderTopWidth),l=o.getBoundingClientRect();return {left:t.left-l.left-n,top:t.top-l.top-i};default:throw new Error("invalid target element given")}default:throw new Error("invalid coordinate system given")}},fromDocumentTo:function(e,t,o){switch(!0){case null==t:throw new Error('no "Position" given');case"number"!=typeof t.left&&!(t.left instanceof Number):case"number"!=typeof t.top&&!(t.top instanceof Number):throw new Error('invalid "Position" given')}switch(e){case null:case void 0:throw new Error("no coordinate system given");case"viewport":return {left:t.left-window.scrollX,top:t.top-window.scrollY};case"document":return {left:t.left,top:t.top};case"local":switch(!0){case null==o:throw new Error("no target element given");case o instanceof Element:var r=window.getComputedStyle(o),n=parseFloat(r.borderLeftWidth),i=parseFloat(r.borderTopWidth),l=o.getBoundingClientRect();return {left:t.left+window.scrollX-l.left-n,top:t.top+window.scrollY-l.top-i};default:throw new Error("invalid target element given")}default:throw new Error("invalid coordinate system given")}},fromLocalTo:function(e,t,o){switch(!0){case null==t:throw new Error('no "Position" given');case"number"!=typeof t.left&&!(t.left instanceof Number):case"number"!=typeof t.top&&!(t.top instanceof Number):throw new Error('invalid "Position" given')}var r,n,i;switch(!0){case null==o:throw new Error("no source element given");case o instanceof Element:var l=window.getComputedStyle(o),a=parseFloat(l.borderLeftWidth),s=parseFloat(l.borderTopWidth);n=(r=o.getBoundingClientRect()).left+a,i=r.top+s;break;default:throw new Error("invalid source element given")}switch(e){case null:case void 0:throw new Error("no coordinate system given");case"viewport":return {left:t.left+n,top:t.top+i};case"document":return {left:t.left+n+window.scrollX,top:t.top+i+window.scrollY};case"local":return {left:t.left,top:t.top};default:throw new Error("invalid coordinate system given")}}};

//----------------------------------------------------------------------------//
/**** parsedDraggableOptions ****/
function parsedDraggableOptions(Options) {
    Options = allowedPlainObject('drag options', Options) || {};
    var Extras, relativeTo;
    var onlyFrom, neverFrom;
    var Dummy, DummyOffsetX, DummyOffsetY;
    var minX, minY, maxX, maxY;
    var onDragStart, onDragMove, onDragEnd, onDragCancel;
    Extras = Options.Extras;
    switch (true) {
        case (Options.relativeTo == null):
            relativeTo = 'parent';
            break;
        case (Options.relativeTo === 'parent'):
        case (Options.relativeTo === 'body'):
        case ValueIsNonEmptyString(Options.relativeTo):
        case (Options.relativeTo instanceof HTMLElement):
        case (Options.relativeTo instanceof SVGElement):
            //    case (Options.relativeTo instanceof MathMLElement):
            relativeTo = Options.relativeTo;
            break;
        default: throwError('InvalidArgument: invalid position reference given');
    }
    onlyFrom = allowedNonEmptyString('"onlyFrom" CSS selector', Options.onlyFrom);
    neverFrom = allowedNonEmptyString('"neverFrom" CSS selector', Options.neverFrom);
    switch (true) {
        case (Options.Dummy == null):
            Dummy = undefined;
            break;
        case (Options.Dummy === 'standard'):
        case (Options.Dummy === 'none'):
        case ValueIsNonEmptyString(Options.Dummy):
        case (Options.Dummy instanceof HTMLElement):
        case (Options.Dummy instanceof SVGElement):
        //    case (Options.Dummy instanceof MathMLElement):
        case ValueIsFunction(Options.Dummy):
            Dummy = Options.Dummy;
            break;
        default: throwError('InvalidArgument: invalid drag dummy specification given');
    }
    DummyOffsetX = allowedFiniteNumber('dummy x offset', Options.DummyOffsetX);
    DummyOffsetY = allowedFiniteNumber('dummy y offset', Options.DummyOffsetY);
    minX = allowedFiniteNumber('min. x position', Options.minX);
    if (minX == null) {
        minX = -Infinity;
    }
    minY = allowedFiniteNumber('min. y position', Options.minY);
    if (minY == null) {
        minY = -Infinity;
    }
    maxX = allowedFiniteNumber('max. x position', Options.maxX);
    if (maxX == null) {
        maxX = Infinity;
    }
    maxY = allowedFiniteNumber('max. y position', Options.maxY);
    if (maxY == null) {
        maxY = Infinity;
    }
    if (ValueIsPosition(Options.onDragStart)) {
        var _a = Options.onDragStart, x_1 = _a.x, y_1 = _a.y;
        onDragStart = function () { return ({ x: x_1, y: y_1 }); };
    }
    else {
        onDragStart = allowedFunction('"onDragStart" handler', Options.onDragStart);
    }
    onDragMove = allowedFunction('"onDragMove" handler', Options.onDragMove);
    onDragEnd = allowedFunction('"onDragEnd" handler', Options.onDragEnd);
    return {
        Extras: Extras,
        relativeTo: relativeTo,
        onlyFrom: onlyFrom,
        neverFrom: neverFrom,
        Dummy: Dummy,
        DummyOffsetX: DummyOffsetX,
        DummyOffsetY: DummyOffsetY,
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        // @ts-ignore we cannot validate given functions any further
        onDragStart: onDragStart,
        onDragMove: onDragMove,
        onDragEnd: onDragEnd,
        onDragCancel: onDragCancel
    };
}
/**** fromForbiddenElement ****/
function fromForbiddenElement(Element, Options, originalEvent) {
    if ((Options.onlyFrom != null) || (Options.neverFrom != null)) {
        var touchedElement = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY);
        var fromElement = touchedElement.closest(Options.onlyFrom);
        if ((Element !== fromElement) && !Element.contains(fromElement)) {
            return true;
        }
        fromElement = touchedElement.closest(Options.neverFrom);
        if ((Element === fromElement) || Element.contains(fromElement)) {
            return true;
        }
    }
    return false;
}
/**** extended Drag-and-Drop Support ****/
var currentDroppableExtras; // extras for currently dragged droppable
var currentDropZoneExtras; // extras for currently hovered drop zone
var currentDropZoneElement; // dto. as Element
var DroppableWasDropped; // indicates a successful drop operation
var currentDropZonePosition; // position relative to DropZone
var currentDropOperation; // actual drop operation
var currentTypeTransferred; // actual type of transferred data
var currentDataTransferred; // actual data transferred
//-------------------------------------------------------------------------------
//--               use:asDroppable={options} - "drag" and "drop"               --
//-------------------------------------------------------------------------------
var DropOperations = ['copy', 'move', 'link'];
/**** parsedDroppableOptions ****/
function parsedDroppableOptions(Options) {
    Options = allowedPlainObject('drop options', Options) || {};
    var Extras, Operations, DataToOffer;
    var onDropZoneEnter, onDropZoneHover, onDropZoneLeave;
    var onDropped;
    Extras = Options.Extras;
    Operations = parsedOperations('list of allowed operations', Options.Operations, 'copy');
    DataToOffer = Object.assign({}, allowedPlainObject('data to be offered', Options.DataToOffer));
    onDropZoneEnter = allowedFunction('"onDropZoneEnter" handler', Options.onDropZoneEnter);
    onDropZoneHover = allowedFunction('"onDropZoneHover" handler', Options.onDropZoneHover);
    onDropZoneLeave = allowedFunction('"onDropZoneLeave" handler', Options.onDropZoneLeave);
    onDropped = allowedFunction('"onDropped" handler', Options.onDropped);
    return {
        Extras: Extras,
        Operations: Operations,
        DataToOffer: DataToOffer,
        // @ts-ignore we cannot validate given functions any further
        onDropZoneEnter: onDropZoneEnter,
        onDropZoneHover: onDropZoneHover,
        onDropZoneLeave: onDropZoneLeave,
        onDropped: onDropped
    };
}
/**** use:asDroppable={options} ****/
function asDroppable(Element, Options) {
    var isDragged;
    var currentDraggableOptions;
    var currentDroppableOptions;
    var PositionReference; // element with user coordinate system
    var ReferenceDeltaX, ReferenceDeltaY; // mouse -> user coord.s
    var PositioningWasDelayed; // workaround for prob. with "drag" events
    var DragImage;
    var initialPosition; // given in user coordinates
    var lastPosition; // dto.
    var lastDropZoneElement;
    var lastDropZoneExtras;
    isDragged = false;
    currentDraggableOptions = parsedDraggableOptions(Options);
    currentDroppableOptions = parsedDroppableOptions(Options);
    /**** startDragging ****/
    function startDragging(originalEvent) {
        var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
        if (fromForbiddenElement(Element, Options, originalEvent)) {
            originalEvent.stopPropagation();
            originalEvent.preventDefault();
            return false;
        }
        PositionReference = PositionReferenceFor(Element, Options);
        var relativePosition = e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
        ReferenceDeltaX = ReferenceDeltaY = 0;
        initialPosition = { x: 0, y: 0 };
        if (Options.onDragStart == null) {
            initialPosition = { x: 0, y: 0 }; // given in user coordinates
        }
        else {
            try {
                var StartPosition = Options.onDragStart(Options.Extras);
                if (ValueIsPlainObject(StartPosition)) {
                    var x = allowedFiniteNumber('x start position', StartPosition.x);
                    var y = allowedFiniteNumber('y start position', StartPosition.y);
                    ReferenceDeltaX = x - relativePosition.left;
                    ReferenceDeltaY = y - relativePosition.top;
                    x = constrained(x, Options.minX, Options.maxX);
                    y = constrained(y, Options.minY, Options.maxY);
                    initialPosition = { x: x, y: y }; // given in user coordinates
                }
            }
            catch (Signal) {
                console.error('"onDragStart" handler failed', Signal);
            }
        }
        lastPosition = initialPosition;
        lastDropZoneElement = undefined;
        lastDropZoneExtras = undefined;
        PositioningWasDelayed = false; // initializes workaround
        if (Options.Dummy == null) {
            Options.Dummy = 'standard'; // this is the default for "use.asDroppable"
        }
        DragImage = DragImageFor(Element, Options);
        if ((DragImage != null) && (originalEvent.dataTransfer != null)) {
            var OffsetX = Options.DummyOffsetX;
            var OffsetY = Options.DummyOffsetY;
            if ((OffsetX == null) || (OffsetY == null)) {
                var PositionInDraggable = e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element);
                if (OffsetX == null) {
                    OffsetX = PositionInDraggable.left;
                }
                if (OffsetY == null) {
                    OffsetY = PositionInDraggable.top;
                }
            }
            switch (true) {
                case (Options.Dummy === 'none'):
                    originalEvent.dataTransfer.setDragImage(DragImage, 0, 0);
                    setTimeout(function () {
                        document.body.removeChild(DragImage);
                    }, 0);
                    break;
                case ValueIsString(Options.Dummy):
                    originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
                    setTimeout(function () {
                        document.body.removeChild(DragImage.parentElement);
                    }, 0);
                    break;
                default:
                    originalEvent.dataTransfer.setDragImage(DragImage, OffsetX, OffsetY);
            }
        }
        if (originalEvent.dataTransfer != null) {
            var allowedEffects = allowedEffectsFrom(Options.Operations);
            originalEvent.dataTransfer.effectAllowed = allowedEffects;
            if (ObjectIsNotEmpty(Options.DataToOffer)) {
                for (var Type in Options.DataToOffer) {
                    if (Options.DataToOffer.hasOwnProperty(Type)) {
                        originalEvent.dataTransfer.setData(Type, Options.DataToOffer[Type]);
                    }
                }
            }
        }
        currentDroppableExtras = Options.Extras;
        currentDropZoneExtras = undefined;
        currentDropZonePosition = undefined;
        DroppableWasDropped = false;
        currentDropOperation = undefined;
        currentTypeTransferred = undefined;
        currentDataTransferred = undefined;
        setTimeout(function () { return Element.classList.add('dragged'); }, 0);
        originalEvent.stopPropagation();
    }
    /**** continueDragging ****/
    function continueDragging(originalEvent) {
        if (!isDragged) {
            return false;
        }
        var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
        if ((originalEvent.screenX === 0) && (originalEvent.screenY === 0) &&
            !PositioningWasDelayed) {
            PositioningWasDelayed = true; // last "drag" event contains wrong coord.s
        }
        else {
            PositioningWasDelayed = false;
            var relativePosition = e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, PositionReference); // relative to reference element
            var x = relativePosition.left + ReferenceDeltaX; // in user coordinates
            var y = relativePosition.top + ReferenceDeltaY;
            x = constrained(x, Options.minX, Options.maxX);
            y = constrained(y, Options.minY, Options.maxY);
            var dx = x - lastPosition.x; // calculated AFTER constraining x,y
            var dy = y - lastPosition.y; // dto.
            lastPosition = { x: x, y: y };
            invokeHandler('onDragMove', Options, x, y, dx, dy, Options.Extras);
        }
        if (currentDropZoneElement === lastDropZoneElement) {
            if (currentDropZoneElement != null) {
                invokeHandler('onDropZoneHover', Options, currentDropZonePosition.x, currentDropZonePosition.y, currentDropZoneExtras, Options.Extras);
            }
        }
        else {
            if (currentDropZoneElement == null) {
                Element.classList.remove('droppable');
                invokeHandler('onDropZoneLeave', Options, lastDropZoneExtras, Options.Extras);
            }
            else {
                Element.classList.add('droppable');
                invokeHandler('onDropZoneEnter', Options, currentDropZonePosition.x, currentDropZonePosition.y, lastDropZoneExtras, Options.Extras);
            }
            lastDropZoneElement = currentDropZoneElement;
            lastDropZoneExtras = currentDropZoneExtras;
        }
        originalEvent.stopPropagation();
    }
    /**** finishDragging ****/
    function finishDragging(originalEvent) {
        if (!isDragged) {
            return false;
        }
        //    continueDragging(originalEvent)           // NO! positions might be wrong!
        var Options = Object.assign({}, currentDraggableOptions, currentDroppableOptions);
        if (DroppableWasDropped) {
            invokeHandler('onDropped', Options, currentDropZonePosition.x, currentDropZonePosition.y, currentDropOperation, currentTypeTransferred, currentDataTransferred, currentDropZoneExtras, Options.Extras);
            currentDropZoneExtras = undefined;
            currentDropZonePosition = undefined;
            DroppableWasDropped = false;
            currentDropOperation = undefined;
            currentTypeTransferred = undefined;
            currentDataTransferred = undefined;
        }
        if (Options.onDragEnd != null) {
            var x = constrained(lastPosition.x, Options.minX, Options.maxX);
            var y = constrained(lastPosition.y, Options.minY, Options.maxY);
            var dx = x - lastPosition.x;
            var dy = y - lastPosition.y;
            invokeHandler('onDragEnd', Options, x, y, dx, dy, Options.Extras);
        }
        currentDroppableExtras = undefined;
        Element.classList.remove('dragged', 'droppable');
        originalEvent.stopPropagation();
    }
    /**** updateDraggableOptions ****/
    function updateDraggableOptions(Options) {
        Options = parsedDraggableOptions(Options);
        currentDraggableOptions.Dummy = (Options.Dummy || currentDraggableOptions.Dummy);
        currentDraggableOptions.minX = Options.minX;
        currentDraggableOptions.minY = Options.minY;
        currentDraggableOptions.maxX = Options.maxX;
        currentDraggableOptions.maxY = Options.maxY;
        currentDraggableOptions.onDragStart = (Options.onDragStart || currentDraggableOptions.onDragStart); // may be used to update initial position for subsequent drags
    }
    /**** updateDroppableOptions ****/
    function updateDroppableOptions(Options) {
        Options = parsedDroppableOptions(Options);
        if (Options.Extras != null) {
            currentDroppableOptions.Extras = Options.Extras;
        }
    }
    Element.setAttribute('draggable', 'true');
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('dragstart', startDragging);
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('drag', continueDragging);
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('dragend', finishDragging);
    return {
        update: function (Options) {
            updateDraggableOptions(Options);
            updateDroppableOptions(Options);
        }
    };
}
/**** parsedDropZoneOptions ****/
function parsedDropZoneOptions(Options) {
    Options = allowedPlainObject('drop zone options', Options) || {};
    var Extras, TypesToAccept, HoldDelay;
    var onDroppableEnter, onDroppableMove, onDroppableLeave;
    var onDroppableHold, onDroppableRelease, onDrop;
    Extras = Options.Extras;
    allowPlainObject('data types to be accepted', Options.TypesToAccept);
    TypesToAccept = Object.create(null);
    for (var Type in Options.TypesToAccept) {
        if (Options.TypesToAccept.hasOwnProperty(Type)) {
            TypesToAccept[Type] = parsedOperations('list of accepted operations for type ' + quoted(Type), Options.TypesToAccept[Type]);
        }
    }
    HoldDelay = allowedIntegerInRange('min. time to hold', Options.HoldDelay, 0);
    onDroppableEnter = allowedFunction('"onDroppableEnter" handler', Options.onDroppableEnter);
    onDroppableMove = allowedFunction('"onDroppableMove" handler', Options.onDroppableMove);
    onDroppableLeave = allowedFunction('"onDroppableLeave" handler', Options.onDroppableLeave);
    onDroppableHold = allowedFunction('"onDroppableHold" handler', Options.onDroppableHold);
    onDroppableRelease = allowedFunction('"onDroppableRelease" handler', Options.onDroppableRelease);
    onDrop = allowedFunction('"onDrop" handler', Options.onDrop);
    return {
        Extras: Extras,
        TypesToAccept: TypesToAccept,
        HoldDelay: HoldDelay,
        // @ts-ignore we cannot validate given functions any further
        onDroppableEnter: onDroppableEnter,
        onDroppableMove: onDroppableMove,
        onDroppableLeave: onDroppableLeave,
        // @ts-ignore we cannot validate given functions any further
        onDroppableHold: onDroppableHold,
        onDroppableRelease: onDroppableRelease,
        onDrop: onDrop
    };
}
/**** use:asDropZone={options} ****/
function asDropZone(Element, Options) {
    var currentDropZoneOptions;
    currentDropZoneOptions = parsedDropZoneOptions(Options);
    /**** enteredByDroppable ****/
    function enteredByDroppable(originalEvent) {
        if ((originalEvent.dataTransfer == null) ||
            (originalEvent.dataTransfer.effectAllowed === 'none')) {
            return;
        }
        var Options = currentDropZoneOptions;
        var wantedOperation = originalEvent.dataTransfer.dropEffect;
        if (wantedOperation === 'none') { // workaround for browser bug
            switch (originalEvent.dataTransfer.effectAllowed) {
                case 'copy':
                case 'move':
                case 'link':
                    wantedOperation = originalEvent.dataTransfer.effectAllowed;
                    break;
                default:
                    wantedOperation = undefined;
            }
        }
        var TypesToAccept = Options.TypesToAccept;
        var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
            return (Type in TypesToAccept) &&
                (TypesToAccept[Type] !== '');
        } // "getData" is not available here
        ); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
        if (offeredTypeList.length === 0) {
            return;
        }
        var DropZonePosition = asPosition(e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
        var accepted = ResultOfHandler('onDroppableEnter', Options, DropZonePosition.x, DropZonePosition.y, wantedOperation, offeredTypeList, currentDroppableExtras, Options.Extras);
        if (accepted === false) {
            return;
        }
        else {
            currentDropZoneExtras = Options.Extras;
            currentDropZoneElement = Element;
            currentDropZonePosition = DropZonePosition;
            Element.classList.add('hovered');
            originalEvent.preventDefault();
            originalEvent.stopPropagation();
        }
    }
    /**** hoveredByDroppable ****/
    function hoveredByDroppable(originalEvent) {
        if ((originalEvent.dataTransfer == null) ||
            (originalEvent.dataTransfer.effectAllowed === 'none') ||
            (currentDropZoneElement !== Element)) {
            return;
        }
        var Options = currentDropZoneOptions;
        var wantedOperation = originalEvent.dataTransfer.dropEffect;
        if (wantedOperation === 'none') { // workaround for browser bug
            switch (originalEvent.dataTransfer.effectAllowed) {
                case 'copy':
                case 'move':
                case 'link':
                    wantedOperation = originalEvent.dataTransfer.effectAllowed;
                    break;
                default:
                    wantedOperation = undefined;
            }
        }
        var TypesToAccept = Options.TypesToAccept;
        var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
            return (Type in TypesToAccept) &&
                (TypesToAccept[Type] !== '');
        } // "getData" is not available here
        ); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
        if (offeredTypeList.length === 0) {
            if (currentDropZoneElement === Element) {
                currentDropZoneExtras = undefined;
                currentDropZoneElement = undefined;
                currentDropZonePosition = undefined;
                Element.classList.remove('hovered');
            }
            return;
        }
        currentDropZonePosition = asPosition(e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
        var accepted = ResultOfHandler('onDroppableMove', Options, currentDropZonePosition.x, currentDropZonePosition.y, wantedOperation, offeredTypeList, currentDroppableExtras, Options.Extras);
        if (accepted === false) {
            currentDropZoneExtras = undefined;
            currentDropZoneElement = undefined;
            currentDropZonePosition = undefined;
            Element.classList.remove('hovered');
        }
        else {
            originalEvent.preventDefault(); // never allow default action!
            //      originalEvent.stopPropagation()
            return false; // special return value when drop seems acceptable
        }
    }
    /**** leftByDroppable ****/
    function leftByDroppable(originalEvent) {
        var Options = currentDropZoneOptions;
        if (currentDropZoneElement === Element) {
            if (currentTypeTransferred == null) {
                currentDropZoneExtras = undefined;
                currentDropZoneElement = undefined;
                DroppableWasDropped = false;
                currentDropZonePosition = undefined;
                currentTypeTransferred = undefined;
                currentDataTransferred = undefined;
                Element.classList.remove('hovered');
                invokeHandler('onDroppableLeave', Options, currentDroppableExtras, Options.Extras);
            } // swallow "dragleave" right after successful "drop"
            originalEvent.preventDefault();
            originalEvent.stopPropagation();
        }
    }
    /**** droppedByDroppable ****/
    function droppedByDroppable(originalEvent) {
        if ((originalEvent.dataTransfer == null) ||
            (originalEvent.dataTransfer.effectAllowed === 'none') ||
            (currentDropZoneElement !== Element)) {
            return;
        }
        //    originalEvent.preventDefault()
        originalEvent.stopPropagation();
        var Options = currentDropZoneOptions;
        var wantedOperation = originalEvent.dataTransfer.dropEffect;
        if (wantedOperation === 'none') { // workaround for browser bug
            switch (originalEvent.dataTransfer.effectAllowed) {
                case 'copy':
                case 'move':
                case 'link':
                    wantedOperation = originalEvent.dataTransfer.effectAllowed;
                    break;
                default:
                    wantedOperation = undefined;
            }
        }
        var TypesToAccept = Options.TypesToAccept;
        var offeredTypeList = originalEvent.dataTransfer.types.filter(function (Type) {
            return (Type in TypesToAccept) && ((wantedOperation == null) ||
                (TypesToAccept[Type].indexOf(wantedOperation) >= 0));
        }); // cannot use "originalEvent.dataTransfer.dropEffect" due to browser bug
        if (offeredTypeList.length === 0) {
            currentDropZoneExtras = undefined;
            currentDropZonePosition = undefined;
            DroppableWasDropped = false;
            currentDropOperation = undefined;
            currentTypeTransferred = undefined;
            currentDataTransferred = undefined;
            Element.classList.remove('hovered');
            invokeHandler('onDroppableLeave', Options, currentDroppableExtras, Options.Extras);
            return;
        }
        currentDropZonePosition = asPosition(e.fromDocumentTo('local', { left: originalEvent.pageX, top: originalEvent.pageY }, Element)); // relative to DropZone element
        var offeredData = {};
        offeredTypeList.forEach(
        // @ts-ignore originalEvent.dataTransfer definitely exists
        function (Type) { return offeredData[Type] = originalEvent.dataTransfer.getData(Type); });
        var acceptedType = ResultOfHandler('onDrop', Options, currentDropZonePosition.x, currentDropZonePosition.y, wantedOperation, offeredData, currentDroppableExtras, Options.Extras);
        switch (true) {
            case (acceptedType == null):
                DroppableWasDropped = true;
                currentDropOperation = wantedOperation;
                currentTypeTransferred = undefined;
                currentDataTransferred = undefined;
                break;
            case ValueIsOneOf(acceptedType, offeredTypeList):
                DroppableWasDropped = true;
                currentDropOperation = wantedOperation;
                currentTypeTransferred = acceptedType;
                currentDataTransferred = offeredData[acceptedType];
                break;
            default: // handler should return false in case of failure
                DroppableWasDropped = false;
                currentDropZoneExtras = undefined;
                currentDropZonePosition = undefined;
                currentDropOperation = undefined;
                currentTypeTransferred = undefined;
                currentDataTransferred = undefined;
            //        invokeHandler('onDroppableLeave', Options, currentDroppableExtras, Options.Extras)
        }
        currentDropZoneElement = undefined;
        Element.classList.remove('hovered');
    }
    /**** updateDropZoneOptions ****/
    function updateDropZoneOptions(Options) {
        Options = parsedDropZoneOptions(Options);
        if (Options.Extras != null) {
            currentDropZoneOptions.Extras = Options.Extras;
        }
        if (ObjectIsNotEmpty(Options.TypesToAccept)) {
            currentDropZoneOptions.TypesToAccept = Options.TypesToAccept;
        }
        if (Options.HoldDelay != null) {
            currentDropZoneOptions.HoldDelay = Options.HoldDelay;
        }
    }
    Element.setAttribute('draggable', 'true');
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('dragenter', enteredByDroppable);
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('dragover', hoveredByDroppable);
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('dragleave', leftByDroppable);
    // @ts-ignore we know that the passed event is a DragEvent
    Element.addEventListener('drop', droppedByDroppable);
    return { update: updateDropZoneOptions };
}
/**** ValueIsPosition ****/
function ValueIsPosition(Candidate) {
    return (ValueIsPlainObject(Candidate) &&
        ValueIsFiniteNumber(Candidate.x) && ValueIsFiniteNumber(Candidate.y));
}
/**** asPosition ****/
function asPosition(Value) {
    return { x: Value.left, y: Value.top };
}
/**** PositionReferenceFor ****/
function PositionReferenceFor(Element, Options) {
    var PositionReference;
    switch (true) {
        case (Options.relativeTo === 'parent'):
            PositionReference = Element.parentElement;
            break;
        case (Options.relativeTo === 'body'):
            PositionReference = document.body;
            break;
        case (Options.relativeTo instanceof HTMLElement):
        case (Options.relativeTo instanceof SVGElement):
            //    case (Options.relativeTo instanceof MathMLElement):
            PositionReference = Options.relativeTo;
            if ((PositionReference != document.body) &&
                !document.body.contains(PositionReference))
                throwError('InvalidArgument: the HTML element given as "relativeTo" option ' +
                    'is not part of this HTML document');
            break;
        default: // CSS selector
            PositionReference = Element.closest(Options.relativeTo);
    }
    return (PositionReference == null ? document.body : PositionReference);
}
/**** DragImageFor ****/
function DragImageFor(Element, Options) {
    switch (true) {
        case (Options.Dummy === 'standard'):
            return undefined;
        case (Options.Dummy === 'none'):
            var invisibleDragImage = document.createElement('div');
            invisibleDragImage.setAttribute('style', 'display:block; position:absolute; width:1px; height:1px; ' +
                'background:transparent; border:none; margin:0px; padding:0px; ' +
                'cursor:auto');
            document.body.appendChild(invisibleDragImage);
            return invisibleDragImage;
        case ValueIsNonEmptyString(Options.Dummy): // may flicker shortly
            var auxiliaryElement = document.createElement('div');
            auxiliaryElement.style.display = 'block';
            auxiliaryElement.style.position = 'absolute';
            auxiliaryElement.style.left = (document.body.scrollWidth + 100) + 'px';
            document.body.appendChild(auxiliaryElement);
            auxiliaryElement.innerHTML = Options.Dummy;
            return auxiliaryElement.children[0];
        case (Options.Dummy instanceof HTMLElement):
        case (Options.Dummy instanceof SVGElement):
            //    case (Options.Dummy instanceof MathMLElement):
            return Options.Dummy;
        case ValueIsFunction(Options.Dummy):
            var Candidate = undefined;
            try {
                Candidate = Options.Dummy(Options.Extras, Element);
            }
            catch (Signal) {
                console.error('RuntimeError: creating draggable dummy failed', Signal);
            }
            if (Candidate != null) {
                if ((Candidate instanceof HTMLElement) || (Candidate instanceof SVGElement)) {
                    return Candidate;
                }
                else {
                    console.error('InvalidArgument: the newly created draggable dummy is ' +
                        'neither an HTML nor an SVG element');
                }
            }
    }
}
/**** parsedOperations ****/
function parsedOperations(Description, Argument, Default) {
    if (Default === void 0) { Default = 'copy move link'; }
    var Operations = allowedString(Description, Argument) || Default;
    switch (Operations.trim()) {
        case 'all': return 'copy move link';
        case 'none': return '';
    }
    var OperationList = Operations.trim().replace(/\s+/g, ' ').split(' ');
    allowListSatisfying(Description, OperationList, function (Operation) { return ValueIsOneOf(Operation, DropOperations); });
    return OperationList.reduce(function (Result, Operation) { return (Result.indexOf(Operation) < 0 ? Result + Operation + ' ' : Result); }, ' ');
}
function allowedEffectsFrom(Operations) {
    var EffectIndex = ( // Horner's method
    (Operations.indexOf('move') < 0 ? 0 : 1) * 2 +
        (Operations.indexOf('link') < 0 ? 0 : 1)) * 2 +
        (Operations.indexOf('copy') < 0 ? 0 : 1);
    return [
        'none', 'copy', 'link', 'copyLink', 'move', 'copyMove', 'linkMove', 'all'
    ][EffectIndex];
}
/**** invokeHandler ****/
function invokeHandler(Name, Options) {
    var Arguments = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        Arguments[_i - 2] = arguments[_i];
    }
    if (Options[Name] != null) {
        try {
            return Options[Name].apply(null, Arguments);
        }
        catch (Signal) {
            console.error(quoted(Name) + ' handler failed', Signal);
        }
    }
}
var ResultOfHandler = invokeHandler;

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

var css_248z = ".List.svelte-xq0rks.svelte-xq0rks{display:inline-block;position:relative;margin:0px;padding:0px 0px 4px 0px;list-style:none}.withoutTextSelection.svelte-xq0rks.svelte-xq0rks{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.List.svelte-xq0rks>li.svelte-xq0rks{display:block;position:relative;border:none;margin:0px;padding:0px;list-style:none}.List.svelte-xq0rks>li.svelte-xq0rks:hover{background:royalblue }.selectableItem.selected.svelte-xq0rks.svelte-xq0rks{background:dodgerblue }.selectableItem.selected.svelte-xq0rks.svelte-xq0rks:hover{background:royalblue }.InsertionPoint.svelte-xq0rks.svelte-xq0rks{display:block;position:relative;width:100%;height:20px;background:transparent;border:none;margin:0px;padding:0px;list-style:none}.AttachmentPoint.svelte-xq0rks.svelte-xq0rks{display:block;position:relative;width:100%;height:20px;background:transparent;border:none;margin:0px;padding:0px;list-style:none}.Placeholder.svelte-xq0rks.svelte-xq0rks{display:flex;position:absolute;left:0px;top:0px;right:0px;height:100%;flex-flow:column nowrap;justify-content:center;align-items:center}";
styleInject(css_248z,{"insertAt":"top"});

/* src/svelte-sortable-flat-list-view.svelte generated by Svelte v3.38.3 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[61] = list[i];
	child_ctx[63] = i;
	return child_ctx;
}

const get_default_slot_changes_1 = dirty => ({
	Item: dirty[0] & /*List*/ 1,
	Index: dirty[0] & /*List*/ 1
});

const get_default_slot_context_1 = ctx => ({
	Item: /*Item*/ ctx[61],
	Index: /*Index*/ ctx[63]
});

const get_default_slot_changes = dirty => ({
	Item: dirty[0] & /*List*/ 1,
	Index: dirty[0] & /*List*/ 1
});

const get_default_slot_context = ctx => ({
	Item: /*Item*/ ctx[61],
	Index: /*Index*/ ctx[63]
});

// (592:2) {:else}
function create_else_block_1(ctx) {
	let li;
	let t;

	return {
		c() {
			li = element("li");
			t = text(/*Placeholder*/ ctx[2]);
			attr(li, "class", "Placeholder svelte-xq0rks");
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*Placeholder*/ 4) set_data(t, /*Placeholder*/ ctx[2]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

// (547:2) {#if (List.length > 0)}
function create_if_block(ctx) {
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t;
	let if_block_anchor;
	let current;
	let each_value = /*List*/ ctx[0];
	const get_key = ctx => /*KeyOf*/ ctx[9](/*Item*/ ctx[61]);

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	let if_block = (/*sortable*/ ctx[3] || /*extendable*/ ctx[12]) && create_if_block_1(ctx);

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
			if (dirty[0] & /*List, neverFrom, onlyFrom, dynamicDummy, onDragStart, onDragEnd, onDropped, onDrop, onDroppableEnter, onDroppableMove, onDroppableLeave, ClassNames, style, isSelected, handleClick, KeyOf, Instruction, InsertionPoint, sortable, extendable, shrinkable*/ 4194299 | dirty[1] & /*$$scope*/ 4096) {
				each_value = /*List*/ ctx[0];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, t.parentNode, outro_and_destroy_block, create_each_block, t, get_each_context);
				check_outros();
			}

			if (/*sortable*/ ctx[3] || /*extendable*/ ctx[12]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_1(ctx);
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

// (575:6) {:else}
function create_else_block(ctx) {
	let li;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[44].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[43], get_default_slot_context_1);
	const default_slot_or_fallback = default_slot || fallback_block_1(ctx);

	function click_handler_1(...args) {
		return /*click_handler_1*/ ctx[46](/*Item*/ ctx[61], ...args);
	}

	return {
		c() {
			li = element("li");
			if (default_slot_or_fallback) default_slot_or_fallback.c();
			attr(li, "class", "svelte-xq0rks");
			toggle_class(li, "selectableItem", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[61]));
		},
		m(target, anchor) {
			insert(target, li, anchor);

			if (default_slot_or_fallback) {
				default_slot_or_fallback.m(li, null);
			}

			current = true;

			if (!mounted) {
				dispose = listen(li, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (default_slot) {
				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 4096)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[43], !current ? [-1, -1, -1] : dirty, get_default_slot_changes_1, get_default_slot_context_1);
				}
			} else {
				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 513)) {
					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
				}
			}

			if (dirty[0] & /*ClassNames, style*/ 48) {
				toggle_class(li, "selectableItem", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			}

			if (dirty[0] & /*isSelected, List*/ 65) {
				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[61]));
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

// (549:6) {#if sortable || extendable || shrinkable}
function create_if_block_2(ctx) {
	let t;
	let li;
	let asDroppable_action;
	let asDropZone_action;
	let current;
	let mounted;
	let dispose;
	let if_block = /*Item*/ ctx[61] === /*InsertionPoint*/ ctx[10] && create_if_block_3(ctx);
	const default_slot_template = /*#slots*/ ctx[44].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[43], get_default_slot_context);
	const default_slot_or_fallback = default_slot || fallback_block(ctx);

	function click_handler(...args) {
		return /*click_handler*/ ctx[45](/*Item*/ ctx[61], ...args);
	}

	return {
		c() {
			if (if_block) if_block.c();
			t = space();
			li = element("li");
			if (default_slot_or_fallback) default_slot_or_fallback.c();
			attr(li, "class", "svelte-xq0rks");
			toggle_class(li, "selectableItem", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[61]));
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, t, anchor);
			insert(target, li, anchor);

			if (default_slot_or_fallback) {
				default_slot_or_fallback.m(li, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(li, "click", click_handler),
					action_destroyer(asDroppable_action = asDroppable.call(null, li, {
						Extras: {
							List: /*List*/ ctx[0],
							Item: /*Item*/ ctx[61]
						},
						neverFrom: /*neverFrom*/ ctx[8],
						onlyFrom: /*onlyFrom*/ ctx[7],
						Dummy: /*dynamicDummy*/ ctx[14],
						onDragStart: /*onDragStart*/ ctx[15],
						onDragEnd: /*onDragEnd*/ ctx[16],
						onDropped: /*onDropped*/ ctx[17]
					})),
					action_destroyer(asDropZone_action = asDropZone.call(null, li, {
						Extras: {
							List: /*List*/ ctx[0],
							Item: /*Item*/ ctx[61],
							ItemList: undefined
						},
						onDrop: /*onDrop*/ ctx[21],
						onDroppableEnter: /*onDroppableEnter*/ ctx[18],
						onDroppableMove: /*onDroppableMove*/ ctx[19],
						onDroppableLeave: /*onDroppableLeave*/ ctx[20]
					}))
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (/*Item*/ ctx[61] === /*InsertionPoint*/ ctx[10]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_3(ctx);
					if_block.c();
					if_block.m(t.parentNode, t);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty[0] & /*List*/ 1 | dirty[1] & /*$$scope*/ 4096)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[43], !current ? [-1, -1, -1] : dirty, get_default_slot_changes, get_default_slot_context);
				}
			} else {
				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty[0] & /*KeyOf, List*/ 513)) {
					default_slot_or_fallback.p(ctx, !current ? [-1, -1, -1] : dirty);
				}
			}

			if (asDroppable_action && is_function(asDroppable_action.update) && dirty[0] & /*List, neverFrom, onlyFrom*/ 385) asDroppable_action.update.call(null, {
				Extras: {
					List: /*List*/ ctx[0],
					Item: /*Item*/ ctx[61]
				},
				neverFrom: /*neverFrom*/ ctx[8],
				onlyFrom: /*onlyFrom*/ ctx[7],
				Dummy: /*dynamicDummy*/ ctx[14],
				onDragStart: /*onDragStart*/ ctx[15],
				onDragEnd: /*onDragEnd*/ ctx[16],
				onDropped: /*onDropped*/ ctx[17]
			});

			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List*/ 1) asDropZone_action.update.call(null, {
				Extras: {
					List: /*List*/ ctx[0],
					Item: /*Item*/ ctx[61],
					ItemList: undefined
				},
				onDrop: /*onDrop*/ ctx[21],
				onDroppableEnter: /*onDroppableEnter*/ ctx[18],
				onDroppableMove: /*onDroppableMove*/ ctx[19],
				onDroppableLeave: /*onDroppableLeave*/ ctx[20]
			});

			if (dirty[0] & /*ClassNames, style*/ 48) {
				toggle_class(li, "selectableItem", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			}

			if (dirty[0] & /*isSelected, List*/ 65) {
				toggle_class(li, "selected", /*isSelected*/ ctx[6](/*Item*/ ctx[61]));
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
			if (if_block) if_block.d(detaching);
			if (detaching) detach(t);
			if (detaching) detach(li);
			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (581:31)  
function fallback_block_1(ctx) {
	let t_value = /*KeyOf*/ ctx[9](/*Item*/ ctx[61]) + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*KeyOf, List*/ 513 && t_value !== (t_value = /*KeyOf*/ ctx[9](/*Item*/ ctx[61]) + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (550:8) {#if Item === InsertionPoint}
function create_if_block_3(ctx) {
	let li;
	let t;
	let asDropZone_action;
	let mounted;
	let dispose;

	return {
		c() {
			li = element("li");
			t = text(/*Instruction*/ ctx[1]);
			attr(li, "class", "svelte-xq0rks");
			toggle_class(li, "InsertionPoint", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, t);

			if (!mounted) {
				dispose = action_destroyer(asDropZone_action = asDropZone.call(null, li, {
					Extras: {
						List: /*List*/ ctx[0],
						Item: /*Item*/ ctx[61]
					},
					onDrop: /*onDrop*/ ctx[21],
					onDroppableEnter: /*onDroppableEnter*/ ctx[18],
					onDroppableMove: /*onDroppableMove*/ ctx[19],
					onDroppableLeave: /*onDroppableLeave*/ ctx[20]
				}));

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty[0] & /*Instruction*/ 2) set_data(t, /*Instruction*/ ctx[1]);

			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List*/ 1) asDropZone_action.update.call(null, {
				Extras: {
					List: /*List*/ ctx[0],
					Item: /*Item*/ ctx[61]
				},
				onDrop: /*onDrop*/ ctx[21],
				onDroppableEnter: /*onDroppableEnter*/ ctx[18],
				onDroppableMove: /*onDroppableMove*/ ctx[19],
				onDroppableLeave: /*onDroppableLeave*/ ctx[20]
			});

			if (dirty[0] & /*ClassNames, style*/ 48) {
				toggle_class(li, "InsertionPoint", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			}
		},
		d(detaching) {
			if (detaching) detach(li);
			mounted = false;
			dispose();
		}
	};
}

// (573:31)  
function fallback_block(ctx) {
	let t_value = /*KeyOf*/ ctx[9](/*Item*/ ctx[61]) + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*KeyOf, List*/ 513 && t_value !== (t_value = /*KeyOf*/ ctx[9](/*Item*/ ctx[61]) + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (548:4) {#each List as Item,Index (KeyOf(Item))}
function create_each_block(key_1, ctx) {
	let first;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_2, create_else_block];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (/*sortable*/ ctx[3] || /*extendable*/ ctx[12] || /*shrinkable*/ ctx[11]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type_1(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		key: key_1,
		first: null,
		c() {
			first = empty();
			if_block.c();
			if_block_anchor = empty();
			this.first = first;
		},
		m(target, anchor) {
			insert(target, first, anchor);
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
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
			if (detaching) detach(first);
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (586:4) {#if sortable || extendable}
function create_if_block_1(ctx) {
	let li;
	let t;
	let asDropZone_action;
	let mounted;
	let dispose;

	return {
		c() {
			li = element("li");
			t = text(/*Instruction*/ ctx[1]);
			attr(li, "class", "AttachmentPoint svelte-xq0rks");
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, t);

			if (!mounted) {
				dispose = action_destroyer(asDropZone_action = asDropZone.call(null, li, {
					Extras: {
						List: /*List*/ ctx[0],
						Item: undefined,
						ItemList: undefined
					},
					onDroppableEnter: /*onDroppableEnter*/ ctx[18],
					onDroppableMove: /*onDroppableMove*/ ctx[19],
					onDrop: /*onDrop*/ ctx[21]
				}));

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*Instruction*/ 2) set_data(t, /*Instruction*/ ctx[1]);

			if (asDropZone_action && is_function(asDropZone_action.update) && dirty[0] & /*List*/ 1) asDropZone_action.update.call(null, {
				Extras: {
					List: /*List*/ ctx[0],
					Item: undefined,
					ItemList: undefined
				},
				onDroppableEnter: /*onDroppableEnter*/ ctx[18],
				onDroppableMove: /*onDroppableMove*/ ctx[19],
				onDrop: /*onDrop*/ ctx[21]
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
	const if_block_creators = [create_if_block, create_else_block_1];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*List*/ ctx[0].length > 0) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	let ul_levels = [
		{ class: /*ClassNames*/ ctx[4] },
		{ style: /*style*/ ctx[5] },
		/*$$restProps*/ ctx[22]
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
			toggle_class(ul, "List", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			toggle_class(ul, "withoutTextSelection", true);
			toggle_class(ul, "svelte-xq0rks", true);
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
				(!current || dirty[0] & /*ClassNames*/ 16) && { class: /*ClassNames*/ ctx[4] },
				(!current || dirty[0] & /*style*/ 32) && { style: /*style*/ ctx[5] },
				dirty[0] & /*$$restProps*/ 4194304 && /*$$restProps*/ ctx[22]
			]));

			toggle_class(ul, "List", /*ClassNames*/ ctx[4] == null && /*style*/ ctx[5] == null);
			toggle_class(ul, "withoutTextSelection", true);
			toggle_class(ul, "svelte-xq0rks", true);
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
		"class","style","List","Key","Instruction","Placeholder","select","selectOnly","selectAll","selectRange","deselect","deselectAll","toggleSelectionOf","selectedItems","isSelected","sortable","onlyFrom","neverFrom","onSortRequest","onSort","Operations","DataToOffer","TypesToAccept","onOuterDropRequest","onDroppedOutside","onDropFromOutside"
	];

	let $$restProps = compute_rest_props($$props, omit_props_names);
	let { $$slots: slots = {}, $$scope } = $$props;
	const dispatch = createEventDispatcher();
	let privateKey = t();

	/**** common Attributes ****/
	let { class: ClassNames } = $$props;

	let { style } = $$props; // dto.
	let { List } = $$props; // the (flat) list to be shown
	let { Key } = $$props; // the value to be used as list key
	let { Instruction } = $$props; // is shown in insertion points
	let { Placeholder } = $$props; // is shown when list is empty
	let KeyOf;

	/**** Key Validation and quick Lookup ****/
	let ItemSet;

	function updateItemSet(...ArgumentsAreForReactivityOnly) {
		ItemSet = Object.create(null);

		List.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (ItemSet[Key] === Item) {
					throwError$1("InvalidArgument: the given \"List\" contains the same item " + "multiple times");
				} else {
					throwError$1("InvalidArgument: the given \"Key\" does not produce unique keys " + "for every \"List\" item");
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
		ItemList.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (!SelectionSet.has(Item)) {
					SelectionSet.set(Item, true);
					dispatch("selected-item", Item);
				}
			} else {
				throwError$1("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
			}
		});

		SelectionRangeBoundaryA = ItemList.length === 1 ? ItemList[0] : undefined;
		SelectionRangeBoundaryB = undefined;
		triggerRedraw();
	}

	function selectOnly(...ItemList) {
		deselectAll();
		select(...ItemList);
	} //  triggerRedraw()                                       // already done before

	function selectAll() {
		List.forEach(Item => {
			if (!SelectionSet.has(Item)) {
				SelectionSet.set(Item, true);
				dispatch("selected-item", Item);
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

		for (let i = firstIndex; i <= lastIndex; i++) {
			if (!SelectionSet.has(List[i])) {
				SelectionSet.set(List[i], true);
				dispatch("selected-item", List[i]);
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
				throwError$1("InvalidArgument: one or multiple of the given items to deselect " + "are not part of the given \"List\"");
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

		ItemList.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (SelectionSet.has(Item)) {
					SelectionSet.delete(Item);
					dispatch("deselected-item", Item);
				} else {
					SelectionSet.set(Item, true);
					dispatch("selected-item", Item);

					if (ItemList.length === 1) {
						SelectionRangeBoundaryA = Item;
						SelectionRangeBoundaryB = undefined;
					}
				}
			} else {
				throwError$1("InvalidArgument: one or multiple of the given items to select " + "or deselect are not part of the given \"List\"");
			}
		});

		triggerRedraw();
	}

	function selectedItems() {
		let Result = List.filter(Item => SelectionSet.has(Item));
		return Result;
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
			case j.PointingAccuracy === "coarse":
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

	
	let isDragging = false;
	let draggedItemList = undefined;
	let InsertionPoint = undefined;
	let { sortable = false } = $$props; // does this list view support "sorting"?
	let { onlyFrom } = $$props;
	let { neverFrom } = $$props;
	let { onSortRequest } = $$props;
	let { onSort } = $$props;
	let { Operations } = $$props;
	let { DataToOffer } = $$props;
	let { TypesToAccept } = $$props;
	let { onOuterDropRequest } = $$props;
	let { onDroppedOutside } = $$props;
	let { onDropFromOutside } = $$props;
	let DataOffered;
	let TypesAccepted;

	/**** parsedOperations ****/
	function parsedOperations(Description, Argument, Default = "copy move link") {
		let Operations = allowedString$1(Description, Argument) || Default;

		switch (Operations.trim()) {
			case "all":
				return "copy move link";
			case "none":
				return "";
		}

		let OperationList = Operations.trim().replace(/\s+/g, " ").split(" ");
		allowListSatisfying$1(Description, OperationList, Operation => ValueIsOneOf$1(Operation, DropOperations));

		return OperationList.reduce(
			(Result, Operation) => Result.indexOf(Operation) < 0
			? Result + Operation + " "
			: Result,
			" "
		);
	}

	/**** prepare for drag-and-drop ****/
	function hasNonPrivateTypes(TypeSet) {
		for (let Type in Set) {
			if (Set.hasOwnProperty(Type) && Type !== privateKey) {
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

		if (draggedItemList.length > 1) {
			// called after "onDragStart"
			let Badge = document.createElement("div");

			Badge.setAttribute("style", "display:block; position:absolute; " + "top:-10px; right:-10px; width:20px; height:20px; " + "background:red; color:white; " + "border:none; border-radius:10px; margin:0px; padding:0px; " + "line-height:20px; text-align:center");
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
		$$invalidate(40, isDragging = true);
		draggedItemList = selectedItems();

		if (!isSelected(DroppableExtras.Item)) {
			draggedItemList.push(DroppableExtras.Item);
		}

		DroppableExtras.ItemList = draggedItemList;
		return { x: 0, y: 0 };
	}

	/**** onDragEnd ****/
	function onDragEnd(x, y, dx, dy, DraggableExtras) {
		$$invalidate(40, isDragging = false);
		draggedItemList = undefined;
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
		let droppedHere = DropZoneExtras != null && DropZoneExtras.List === List;

		if (!droppedHere) {
			if (onDroppedOutside != null) {
				try {
					onDroppedOutside(x, y, Operation, TypeTransferred, DataTransferred, DropZoneExtras, DroppableExtras);
				} catch(Signal) {
					console.error("RuntimeError: callback \"onDroppedOutside\" failed", Signal);
				} // no event to be dispatched (there is already the callback)

				triggerRedraw(); // just to be on the safe side
			} else {
				let DroppableSet = SetOfItemsIn(DroppableExtras.ItemList);

				for (let i = List.length - 1; i >= 0; i--) {
					let Key = KeyOf(List[i]);

					if (Key in DroppableSet) {
						List.splice(i, 1);
					}
				}

				dispatch("removed-items", DroppableExtras.ItemList.slice());
				triggerRedraw();
			}
		}
	}

	/**** onDroppableEnter ****/
	function onDroppableEnter(x, y, Operation, offeredTypeList, DroppableExtras, DropZoneExtras) {
		let draggedItem = DroppableExtras && DroppableExtras.Item;

		if (draggedItem == (DropZoneExtras && DropZoneExtras.Item)) {
			$$invalidate(10, InsertionPoint = undefined);
			return false;
		}

		let mayBeInsertedHere = true; // because dnd-action already checked a bit

		if (List === (DroppableExtras && DroppableExtras.List)) {
			// own elements
			if (sortable) {
				if (onSortRequest != null) {
					try {
						mayBeInsertedHere = onSortRequest(x, y, DropZoneExtras, DroppableExtras);
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
					mayBeInsertedHere = onOuterDropRequest(x, y, Operation, offeredTypeList, DropZoneExtras, DroppableExtras);
				} catch(Signal) {
					mayBeInsertedHere = false;
					console.error("RuntimeError: callback \"onOuterDropRequest\" failed", Signal);
				}
			}
		}

		$$invalidate(10, InsertionPoint = mayBeInsertedHere ? DropZoneExtras.Item : undefined);
		return mayBeInsertedHere && Operation !== "link";
	}

	/**** onDroppableMove ****/
	const onDroppableMove = onDroppableEnter;

	/**** onDroppableLeave ****/
	function onDroppableLeave(DroppableExtras, DropZoneExtras) {
		$$invalidate(10, InsertionPoint = undefined);
	}

	/**** onDrop ****/
	function onDrop(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras) {
		$$invalidate(10, InsertionPoint = undefined);
		let draggedItem = DroppableExtras && DroppableExtras.Item;

		if (draggedItem == (DropZoneExtras && DropZoneExtras.Item)) {
			return "none";
		} // oops, draggable drop zone was dropped onto itself

		if (List === (DroppableExtras && DroppableExtras.List)) {
			// own elements
			if (sortable) {
				if (onSort == null) {
					let ItemsToBeShifted = DroppableExtras.ItemList;
					let DroppableSet = SetOfItemsIn(ItemsToBeShifted);

					for (let i = List.length - 1; i >= 0; i--) {
						let Key = KeyOf(List[i]);

						if (Key in DroppableSet) {
							List.splice(i, 1);
						}
					}

					let InsertionIndex = List.indexOf(DropZoneExtras && DropZoneExtras.Item);

					if (InsertionIndex < 0) {
						InsertionIndex = List.length;
					} // for append

					// @ts-ignore argument list of "apply" is known to be correct
					List.splice.apply(List, [InsertionIndex, 0].concat(ItemsToBeShifted));

					dispatch("shifted-items", [ItemsToBeShifted, InsertionIndex]);
					triggerRedraw();
				} else {
					try {
						onSort(DropZoneExtras.Item, DroppableExtras.ItemList);
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

				if (!ValueIsList(ItemsToBeInserted)) {
					return "none";
				}

				let InsertionIndex = List.indexOf(DropZoneExtras && DropZoneExtras.Item);

				if (InsertionIndex < 0) {
					InsertionIndex = List.length;
				} // for "append"

				// @ts-ignore argument list of "apply" is known to be correct
				List.splice.apply(List, [InsertionIndex, 0].concat(ItemsToBeInserted));

				dispatch("inserted-items", [ItemsToBeInserted, InsertionIndex]);
				triggerRedraw();
				return Operation;
			} else {
				let actualOperation = "none";

				try {
					actualOperation = onDropFromOutside(x, y, Operation, DataOffered, DroppableExtras, DropZoneExtras);
				} catch(Signal) {
					console.error("RuntimeError: callback \"onSort\" failed", Signal);
				} // no event to be dispatched (there is already the callback)

				triggerRedraw(); // just to be on the safe side
				return actualOperation || "none";
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
		$$invalidate(22, $$restProps = compute_rest_props($$props, omit_props_names));
		if ("class" in $$new_props) $$invalidate(4, ClassNames = $$new_props.class);
		if ("style" in $$new_props) $$invalidate(5, style = $$new_props.style);
		if ("List" in $$new_props) $$invalidate(0, List = $$new_props.List);
		if ("Key" in $$new_props) $$invalidate(23, Key = $$new_props.Key);
		if ("Instruction" in $$new_props) $$invalidate(1, Instruction = $$new_props.Instruction);
		if ("Placeholder" in $$new_props) $$invalidate(2, Placeholder = $$new_props.Placeholder);
		if ("sortable" in $$new_props) $$invalidate(3, sortable = $$new_props.sortable);
		if ("onlyFrom" in $$new_props) $$invalidate(7, onlyFrom = $$new_props.onlyFrom);
		if ("neverFrom" in $$new_props) $$invalidate(8, neverFrom = $$new_props.neverFrom);
		if ("onSortRequest" in $$new_props) $$invalidate(32, onSortRequest = $$new_props.onSortRequest);
		if ("onSort" in $$new_props) $$invalidate(33, onSort = $$new_props.onSort);
		if ("Operations" in $$new_props) $$invalidate(34, Operations = $$new_props.Operations);
		if ("DataToOffer" in $$new_props) $$invalidate(35, DataToOffer = $$new_props.DataToOffer);
		if ("TypesToAccept" in $$new_props) $$invalidate(36, TypesToAccept = $$new_props.TypesToAccept);
		if ("onOuterDropRequest" in $$new_props) $$invalidate(37, onOuterDropRequest = $$new_props.onOuterDropRequest);
		if ("onDroppedOutside" in $$new_props) $$invalidate(38, onDroppedOutside = $$new_props.onDroppedOutside);
		if ("onDropFromOutside" in $$new_props) $$invalidate(39, onDropFromOutside = $$new_props.onDropFromOutside);
		if ("$$scope" in $$new_props) $$invalidate(43, $$scope = $$new_props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*ClassNames*/ 16) {
			allowNonEmptyString$1("\"class\" attribute", ClassNames);
		}

		if ($$self.$$.dirty[0] & /*style*/ 32) {
			allowNonEmptyString$1("\"style\" attribute", style);
		}

		if ($$self.$$.dirty[0] & /*List*/ 1) {
			$$invalidate(0, List = allowedListSatisfying("\"List\" attribute", List, ValueIsObject$1) || []);
		}

		if ($$self.$$.dirty[0] & /*Key*/ 8388608) {
			switch (true) {
				case Key == null:
					$$invalidate(9, KeyOf = Item => String(Item));
					break;
				case ValueIsNonEmptyString$1(Key):
					$$invalidate(9, KeyOf = Item => String(Item[Key]));
					break;
				case ValueIsFunction$1(Key):
					$$invalidate(9, KeyOf = Item => String(Key(Item)));
					break;
				default:
					throwError$1("InvalidArgument: the given \"Key\" attribute is neither " + "a non-empty string nor a function returning such a string");
			}
		}

		if ($$self.$$.dirty[0] & /*Instruction*/ 2) {
			$$invalidate(1, Instruction = allowedNonEmptyString$1("\"Instruction\" attribute", Instruction) || "drop here");
		}

		if ($$self.$$.dirty[0] & /*Placeholder*/ 4) {
			$$invalidate(2, Placeholder = allowedNonEmptyString$1("\"Placeholder\" attribute", Placeholder) || "(empty list)");
		}

		if ($$self.$$.dirty[0] & /*List, Key*/ 8388609) {
			updateItemSet(List, Key);
		}

		if ($$self.$$.dirty[0] & /*sortable*/ 8) {
			$$invalidate(3, sortable = allowedBoolean("\"sortable\" attribute", sortable) || false);
		}

		if ($$self.$$.dirty[0] & /*onlyFrom*/ 128) {
			allowNonEmptyString$1("\"onlyFrom\" CSS selector list", onlyFrom);
		}

		if ($$self.$$.dirty[0] & /*neverFrom*/ 256) {
			allowNonEmptyString$1("\"neverFrom\" CSS selector list", neverFrom);
		}

		if ($$self.$$.dirty[1] & /*onSortRequest*/ 2) {
			allowFunction$1("\"onSortRequest\" callback", onSortRequest);
		}

		if ($$self.$$.dirty[1] & /*onSort*/ 4) {
			allowFunction$1("\"onSort\" callback", onSort);
		}

		if ($$self.$$.dirty[1] & /*Operations*/ 8) {
			parsedOperations("list of allowed operations", Operations);
		}

		if ($$self.$$.dirty[1] & /*DataToOffer*/ 16) {
			allowPlainObject$1("\"DataToOffer\" attribute", DataToOffer);
		}

		if ($$self.$$.dirty[1] & /*TypesToAccept*/ 32) {
			allowPlainObject$1("\"TypesToAccept\" attribute", TypesToAccept);
		}

		if ($$self.$$.dirty[1] & /*onOuterDropRequest*/ 64) {
			allowFunction$1("\"onOuterDropRequest\" callback", onOuterDropRequest);
		}

		if ($$self.$$.dirty[1] & /*onDroppedOutside*/ 128) {
			allowFunction$1("\"onDroppedOutside\" callback", onDroppedOutside);
		}

		if ($$self.$$.dirty[1] & /*onDropFromOutside*/ 256) {
			allowFunction$1("\"onDropFromOutside\" callback", onDropFromOutside);
		}

		if ($$self.$$.dirty[0] & /*sortable*/ 8 | $$self.$$.dirty[1] & /*isDragging, DataToOffer*/ 528) {
			if (!isDragging) {
				// do not update while already dragging
				$$invalidate(41, DataOffered = Object.assign({}, DataToOffer));

				// @ts-ignore "DataOffered" is definitely not undefined
				if (sortable) {
					$$invalidate(41, DataOffered[privateKey] = "", DataOffered);
				}
			}
		}

		if ($$self.$$.dirty[0] & /*sortable*/ 8 | $$self.$$.dirty[1] & /*isDragging, TypesToAccept*/ 544) {
			if (!isDragging) {
				// do not update while already dragging
				$$invalidate(42, TypesAccepted = {});

				for (let Type in TypesToAccept) {
					if (TypesToAccept.hasOwnProperty(Type)) {
						// @ts-ignore "TypesAccepted" is definitely not undefined
						$$invalidate(42, TypesAccepted[Type] = parsedOperations("list of accepted operations for type " + quoted$1(Type), TypesToAccept[Type]), TypesAccepted);
					}
				}

				// @ts-ignore "TypesAccepted" is definitely not undefined
				if (sortable) {
					$$invalidate(42, TypesAccepted[privateKey] = "copy", TypesAccepted);
				}
			} // 'copy' because of the better visual feedback from native drag-and-drop
		}

		if ($$self.$$.dirty[1] & /*isDragging, DataOffered, TypesAccepted*/ 3584) {
			if (!isDragging) {
				// do not update while already dragging
				$$invalidate(11, shrinkable = hasNonPrivateTypes());

				$$invalidate(12, extendable = hasNonPrivateTypes());
			}
		}
	};

	return [
		List,
		Instruction,
		Placeholder,
		sortable,
		ClassNames,
		style,
		isSelected,
		onlyFrom,
		neverFrom,
		KeyOf,
		InsertionPoint,
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
		select,
		selectOnly,
		selectAll,
		selectRange,
		deselect,
		deselectAll,
		toggleSelectionOf,
		selectedItems,
		onSortRequest,
		onSort,
		Operations,
		DataToOffer,
		TypesToAccept,
		onOuterDropRequest,
		onDroppedOutside,
		onDropFromOutside,
		isDragging,
		DataOffered,
		TypesAccepted,
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
				class: 4,
				style: 5,
				List: 0,
				Key: 23,
				Instruction: 1,
				Placeholder: 2,
				select: 24,
				selectOnly: 25,
				selectAll: 26,
				selectRange: 27,
				deselect: 28,
				deselectAll: 29,
				toggleSelectionOf: 30,
				selectedItems: 31,
				isSelected: 6,
				sortable: 3,
				onlyFrom: 7,
				neverFrom: 8,
				onSortRequest: 32,
				onSort: 33,
				Operations: 34,
				DataToOffer: 35,
				TypesToAccept: 36,
				onOuterDropRequest: 37,
				onDroppedOutside: 38,
				onDropFromOutside: 39
			},
			[-1, -1, -1]
		);
	}

	get class() {
		return this.$$.ctx[4];
	}

	set class(ClassNames) {
		this.$set({ class: ClassNames });
		flush();
	}

	get style() {
		return this.$$.ctx[5];
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
		return this.$$.ctx[23];
	}

	set Key(Key) {
		this.$set({ Key });
		flush();
	}

	get Instruction() {
		return this.$$.ctx[1];
	}

	set Instruction(Instruction) {
		this.$set({ Instruction });
		flush();
	}

	get Placeholder() {
		return this.$$.ctx[2];
	}

	set Placeholder(Placeholder) {
		this.$set({ Placeholder });
		flush();
	}

	get select() {
		return this.$$.ctx[24];
	}

	get selectOnly() {
		return this.$$.ctx[25];
	}

	get selectAll() {
		return this.$$.ctx[26];
	}

	get selectRange() {
		return this.$$.ctx[27];
	}

	get deselect() {
		return this.$$.ctx[28];
	}

	get deselectAll() {
		return this.$$.ctx[29];
	}

	get toggleSelectionOf() {
		return this.$$.ctx[30];
	}

	get selectedItems() {
		return this.$$.ctx[31];
	}

	get isSelected() {
		return this.$$.ctx[6];
	}

	get sortable() {
		return this.$$.ctx[3];
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
		return this.$$.ctx[32];
	}

	set onSortRequest(onSortRequest) {
		this.$set({ onSortRequest });
		flush();
	}

	get onSort() {
		return this.$$.ctx[33];
	}

	set onSort(onSort) {
		this.$set({ onSort });
		flush();
	}

	get Operations() {
		return this.$$.ctx[34];
	}

	set Operations(Operations) {
		this.$set({ Operations });
		flush();
	}

	get DataToOffer() {
		return this.$$.ctx[35];
	}

	set DataToOffer(DataToOffer) {
		this.$set({ DataToOffer });
		flush();
	}

	get TypesToAccept() {
		return this.$$.ctx[36];
	}

	set TypesToAccept(TypesToAccept) {
		this.$set({ TypesToAccept });
		flush();
	}

	get onOuterDropRequest() {
		return this.$$.ctx[37];
	}

	set onOuterDropRequest(onOuterDropRequest) {
		this.$set({ onOuterDropRequest });
		flush();
	}

	get onDroppedOutside() {
		return this.$$.ctx[38];
	}

	set onDroppedOutside(onDroppedOutside) {
		this.$set({ onDroppedOutside });
		flush();
	}

	get onDropFromOutside() {
		return this.$$.ctx[39];
	}

	set onDropFromOutside(onDropFromOutside) {
		this.$set({ onDropFromOutside });
		flush();
	}
}

export default Svelte_sortable_flat_list_view;
//# sourceMappingURL=svelte-sortable-flat-list-view.esm.js.map
