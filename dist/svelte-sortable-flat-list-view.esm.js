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
/**** allow/expect[ed]NonEmptyString ****/
var allowNonEmptyString = /*#__PURE__*/ ValidatorForClassifier(ValueIsNonEmptyString, acceptNil, 'non-empty literal string'), allowedNonEmptyString = allowNonEmptyString;
/**** allow[ed]ListSatisfying ****/
function allowListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength) {
    return (Argument == null
        ? Argument
        : expectedListSatisfying(Description, Argument, Validator, Expectation, minLength, maxLength));
}
var allowedListSatisfying = allowListSatisfying;
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

var e,n=!1;e=navigator.userAgent||navigator.vendor||window.opera,(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(e)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(e.substr(0,4)))&&(n=!0);var i=!1;if(n){var t=window.innerWidth,a=window.innerHeight,o=Math.min(t,a),r=Math.max(t,a);i=o<=480&&r<=896;}var c=window.matchMedia||window.webkitMatchmedia||window.mozMatchmedia||window.oMatchmedia;function d(e){return null!=c&&c(e).matches}function s(){return "interactive"===document.readyState||"complete"===document.readyState}var l,m=!d("(pointer:fine)")&&!d("(pointer:coarse)")&&!d("-moz-touch-enabled")&&("ontouchstart"in Window||(navigator.maxTouchPoints||0)>0||/touch|android|iphone|ipod|ipad/i.test(navigator.userAgent));function u(){var e="fine";switch(!0){case d("(pointer:none)"):e="none";break;case d("(pointer:coarse)"):case d("-moz-touch-enabled"):case m:e="coarse";}if(l=e,s())switch(document.body.classList.remove("noPointer","finePointer","coarsePointer"),e){case"none":document.body.classList.add("noPointer");break;case"fine":document.body.classList.add("finePointer");break;case"coarse":document.body.classList.add("coarsePointer");}}u(),s()||window.addEventListener("DOMContentLoaded",u);var p=[];function h(e,n){if("function"!=typeof e)throw new Error("handler function expected");for(var i=0,t=p.length;i<t;i++)if(p[i].Handler===e)return void(p[i].onceOnly=n);p.push({Handler:e,onceOnly:n}),1===p.length&&(v=setInterval((function(){var e=l;u(),l!==e&&function(){for(var e=0,n=p.length;e<n;e++){var i=p[e],t=i.Handler,a=i.onceOnly;try{t(l);}catch(e){console.warn("PointingAccuracy observation function failed with",e);}a&&g(t);}}();}),500));}function g(e){for(var n=0,i=p.length;n<i;n++)if(p[n].Handler===e){p.splice(n,1);break}0===p.length&&(clearInterval(v),v=void 0);}var v=void 0;function w(e,n){return "function"==typeof e.item?e.item(n):e[n]}function f(e,n){for(var i=0,t=e.length;i<t;i++)if(n.test(w(e,i)))return !0;return !1}if(m){for(var b=document.styleSheets,y=0,k=b.length;y<k;y++)for(var x=b[y].cssRules||b[y].rules,P=0,z=x.length;P<z;P++){var A=x[P];if(A.type===CSSRule.MEDIA_RULE&&f(A.media,/handheld/i)){var M=A.media;M.mediaText=M.mediaText.replace("handheld","screen");}}var L=document.getElementsByTagName("link");for(y=0,k=L.length;y<k;y++){var T=L[y];/handheld/i.test(T.media)&&(T.media=T.media.replace("handheld","screen"));}}var j={get isMobile(){return n},get isPhone(){return i},get isTablet(){return n&&!i},get isLegacyTouchDevice(){return m},get PointingAccuracy(){return l},onPointingAccuracyChanged:function(e){h(e,!1);},oncePointingAccuracyChanged:function(e){h(e,!0);},offPointingAccuracyChanged:function(e){g(e);},get observesPointingAccuracy(){return null!=v}};

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

var css_248z = ".List.svelte-1cg3e25.svelte-1cg3e25{display:inline-block;position:relative;margin:0px;padding:0px;list-style:none}.withoutTextSelection.svelte-1cg3e25.svelte-1cg3e25{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.List.svelte-1cg3e25>li.svelte-1cg3e25{display:block;position:relative;margin:0px;padding:0px;list-style:none}.selectableItem.selected.svelte-1cg3e25.svelte-1cg3e25{background:dodgerblue}li.centered.svelte-1cg3e25.svelte-1cg3e25{display:flex;position:absolute;left:0px;top:0px;right:0px;height:100%;flex-flow:column nowrap;justify-content:center;align-items:center}";
styleInject(css_248z,{"insertAt":"top"});

/* src/svelte-sortable-flat-list-view.svelte generated by Svelte v3.38.3 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[28] = list[i];
	child_ctx[30] = i;
	return child_ctx;
}

const get_default_slot_changes = dirty => ({
	Item: dirty & /*List*/ 1,
	Index: dirty & /*List*/ 1
});

const get_default_slot_context = ctx => ({
	Item: /*Item*/ ctx[28],
	Index: /*Index*/ ctx[30]
});

// (267:2) {:else}
function create_else_block(ctx) {
	let li;
	let t;

	return {
		c() {
			li = element("li");
			t = text(/*Placeholder*/ ctx[1]);
			attr(li, "class", "centered svelte-1cg3e25");
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, t);
		},
		p(ctx, dirty) {
			if (dirty & /*Placeholder*/ 2) set_data(t, /*Placeholder*/ ctx[1]);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

// (255:2) {#if (List.length > 0)}
function create_if_block(ctx) {
	let each_blocks = [];
	let each_1_lookup = new Map();
	let each_1_anchor;
	let current;
	let each_value = /*List*/ ctx[0];
	const get_key = ctx => /*KeyOf*/ ctx[5](/*Item*/ ctx[28]);

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
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
			if (dirty & /*ClassNames, style, isSelected, List, handleOnClick, KeyOf, $$scope*/ 131197) {
				each_value = /*List*/ ctx[0];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block, each_1_anchor, get_each_context);
				check_outros();
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

			if (detaching) detach(each_1_anchor);
		}
	};
}

// (262:29)            
function fallback_block(ctx) {
	let t_value = /*KeyOf*/ ctx[5](/*Item*/ ctx[28]) + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*KeyOf, List*/ 33 && t_value !== (t_value = /*KeyOf*/ ctx[5](/*Item*/ ctx[28]) + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (256:4) {#each List as Item,Index (KeyOf(Item))}
function create_each_block(key_1, ctx) {
	let li;
	let t;
	let current;
	let mounted;
	let dispose;
	const default_slot_template = /*#slots*/ ctx[18].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[17], get_default_slot_context);
	const default_slot_or_fallback = default_slot || fallback_block(ctx);

	function click_handler(...args) {
		return /*click_handler*/ ctx[19](/*Item*/ ctx[28], ...args);
	}

	return {
		key: key_1,
		first: null,
		c() {
			li = element("li");
			if (default_slot_or_fallback) default_slot_or_fallback.c();
			t = space();
			attr(li, "class", "svelte-1cg3e25");
			toggle_class(li, "selectableItem", /*ClassNames*/ ctx[2] == null && /*style*/ ctx[3] == null);
			toggle_class(li, "selected", /*isSelected*/ ctx[4](/*Item*/ ctx[28]));
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
				dispose = listen(li, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope, List*/ 131073)) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[17], !current ? -1 : dirty, get_default_slot_changes, get_default_slot_context);
				}
			} else {
				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty & /*KeyOf, List*/ 33)) {
					default_slot_or_fallback.p(ctx, !current ? -1 : dirty);
				}
			}

			if (dirty & /*ClassNames, style*/ 12) {
				toggle_class(li, "selectableItem", /*ClassNames*/ ctx[2] == null && /*style*/ ctx[3] == null);
			}

			if (dirty & /*isSelected, List*/ 17) {
				toggle_class(li, "selected", /*isSelected*/ ctx[4](/*Item*/ ctx[28]));
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

function create_fragment(ctx) {
	let ul;
	let current_block_type_index;
	let if_block;
	let current;
	const if_block_creators = [create_if_block, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*List*/ ctx[0].length > 0) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	let ul_levels = [
		{ class: /*ClassNames*/ ctx[2] },
		{ style: /*style*/ ctx[3] },
		/*$$restProps*/ ctx[7]
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
			toggle_class(ul, "List", /*ClassNames*/ ctx[2] == null && /*style*/ ctx[3] == null);
			toggle_class(ul, "withoutTextSelection", true);
			toggle_class(ul, "svelte-1cg3e25", true);
		},
		m(target, anchor) {
			insert(target, ul, anchor);
			if_blocks[current_block_type_index].m(ul, null);
			current = true;
		},
		p(ctx, [dirty]) {
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
				(!current || dirty & /*ClassNames*/ 4) && { class: /*ClassNames*/ ctx[2] },
				(!current || dirty & /*style*/ 8) && { style: /*style*/ ctx[3] },
				dirty & /*$$restProps*/ 128 && /*$$restProps*/ ctx[7]
			]));

			toggle_class(ul, "List", /*ClassNames*/ ctx[2] == null && /*style*/ ctx[3] == null);
			toggle_class(ul, "withoutTextSelection", true);
			toggle_class(ul, "svelte-1cg3e25", true);
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
		"class","style","List","Key","Placeholder","select","selectOnly","selectAll","selectRange","deselect","deselectAll","toggleSelectionOf","selectedItems","isSelected"
	];

	let $$restProps = compute_rest_props($$props, omit_props_names);
	let { $$slots: slots = {}, $$scope } = $$props;
	const dispatch = createEventDispatcher();
	let { class: ClassNames } = $$props;
	let { style } = $$props; // dto.
	let { List } = $$props; // the (flat) list to be shown
	let { Key } = $$props; // the value to be used as list key
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
					throwError("InvalidArgument: the given \"List\" contains the same item " + "multiple times");
				} else {
					throwError("InvalidArgument: the given \"Key\" does not produce unique keys " + "for every \"List\" item");
				}
			} else {
				ItemSet[Key] = Item;
			}
		});
	}

	let SelectionSet = new WeakMap();

	function select(...ItemList) {
		ItemList.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (!SelectionSet.has(Item)) {
					SelectionSet.set(Item, true);
					dispatch("selected", Item);
				}
			} else {
				throwError("InvalidArgument: one or multiple of the given items to select " + "are not part of the given \"List\"");
			}
		});

		SelectionRangeBoundaryA = ItemList.length === 1 ? ItemList[0] : undefined;
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
				dispatch("selected", Item);
			}
		});

		SelectionRangeBoundaryA = undefined;
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
				dispatch("selected", List[i]);
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
				dispatch("deselected", List[i]);
			}
		}
	}

	function deselect(...ItemList) {
		ItemList.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (SelectionSet.has(Item)) {
					SelectionSet.delete(Item);
					dispatch("deselected", Item);
				}
			} else {
				throwError("InvalidArgument: one or multiple of the given items to deselect " + "are not part of the given \"List\"");
			}
		});

		SelectionRangeBoundaryA = undefined;
		triggerRedraw();
	}

	function deselectAll() {
		List.forEach(Item => {
			if (SelectionSet.has(Item)) {
				SelectionSet.delete(Item);
				dispatch("deselected", Item);
			}
		});

		SelectionRangeBoundaryA = undefined;
		triggerRedraw();
	}

	function toggleSelectionOf(...ItemList) {
		SelectionRangeBoundaryA = undefined;

		ItemList.forEach(Item => {
			let Key = KeyOf(Item);

			if (Key in ItemSet) {
				if (SelectionSet.has(Item)) {
					SelectionSet.delete(Item);
					dispatch("deselected", Item);
				} else {
					SelectionSet.set(Item, true);
					dispatch("selected", Item);

					if (ItemList.length === 1) {
						SelectionRangeBoundaryA = Item;
					}
				}
			} else {
				throwError("InvalidArgument: one or multiple of the given items to select " + "or deselect are not part of the given \"List\"");
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

	/**** handleOnClick ****/
	function handleOnClick(Event, Item) {
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

	/**** triggerRedraw ****/
	function triggerRedraw() {
		$$invalidate(0, List);
	}

	const click_handler = (Item, Event) => handleOnClick(Event, Item);

	$$self.$$set = $$new_props => {
		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
		$$invalidate(7, $$restProps = compute_rest_props($$props, omit_props_names));
		if ("class" in $$new_props) $$invalidate(2, ClassNames = $$new_props.class);
		if ("style" in $$new_props) $$invalidate(3, style = $$new_props.style);
		if ("List" in $$new_props) $$invalidate(0, List = $$new_props.List);
		if ("Key" in $$new_props) $$invalidate(8, Key = $$new_props.Key);
		if ("Placeholder" in $$new_props) $$invalidate(1, Placeholder = $$new_props.Placeholder);
		if ("$$scope" in $$new_props) $$invalidate(17, $$scope = $$new_props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*ClassNames*/ 4) {
			allowNonEmptyString("\"class\" attribute", ClassNames);
		}

		if ($$self.$$.dirty & /*style*/ 8) {
			allowNonEmptyString("\"style\" attribute", style);
		}

		if ($$self.$$.dirty & /*List*/ 1) {
			$$invalidate(0, List = allowedListSatisfying("\"List\" attribute", List, ValueIsObject) || []);
		}

		if ($$self.$$.dirty & /*Key*/ 256) {
			switch (true) {
				case Key == null:
					$$invalidate(5, KeyOf = Item => String(Item));
					break;
				case ValueIsNonEmptyString(Key):
					$$invalidate(5, KeyOf = Item => String(Item[Key]));
					break;
				case ValueIsFunction(Key):
					$$invalidate(5, KeyOf = Item => String(Key(Item)));
					break;
				default:
					throwError("InvalidArgument: the given \"Key\" attribute is neither " + "a non-empty string nor a function returning such a string");
			}
		}

		if ($$self.$$.dirty & /*Placeholder*/ 2) {
			$$invalidate(1, Placeholder = allowedNonEmptyString("\"Placeholder\" attribute", Placeholder) || "(empty list)");
		}

		if ($$self.$$.dirty & /*List, Key*/ 257) {
			updateItemSet(List, Key);
		}
	};

	return [
		List,
		Placeholder,
		ClassNames,
		style,
		isSelected,
		KeyOf,
		handleOnClick,
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
		$$scope,
		slots,
		click_handler
	];
}

class Svelte_sortable_flat_list_view extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			class: 2,
			style: 3,
			List: 0,
			Key: 8,
			Placeholder: 1,
			select: 9,
			selectOnly: 10,
			selectAll: 11,
			selectRange: 12,
			deselect: 13,
			deselectAll: 14,
			toggleSelectionOf: 15,
			selectedItems: 16,
			isSelected: 4
		});
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
		return this.$$.ctx[8];
	}

	set Key(Key) {
		this.$set({ Key });
		flush();
	}

	get Placeholder() {
		return this.$$.ctx[1];
	}

	set Placeholder(Placeholder) {
		this.$set({ Placeholder });
		flush();
	}

	get select() {
		return this.$$.ctx[9];
	}

	get selectOnly() {
		return this.$$.ctx[10];
	}

	get selectAll() {
		return this.$$.ctx[11];
	}

	get selectRange() {
		return this.$$.ctx[12];
	}

	get deselect() {
		return this.$$.ctx[13];
	}

	get deselectAll() {
		return this.$$.ctx[14];
	}

	get toggleSelectionOf() {
		return this.$$.ctx[15];
	}

	get selectedItems() {
		return this.$$.ctx[16];
	}

	get isSelected() {
		return this.$$.ctx[4];
	}
}

export default Svelte_sortable_flat_list_view;
//# sourceMappingURL=svelte-sortable-flat-list-view.esm.js.map
