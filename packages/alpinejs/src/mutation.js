/**
 * @typedef {{
 * name: string,
 * value: string | null }} Attribute
 */

/**
 * @callback AttributeAddedCallback
 * @param {Element} el
 * @param {Attribute[]} attributes
 * @returns {void}
 */

/**
 * @callback AttributeCleanupCallback
 * @returns {void}
 */

/**
 * @callback ElAddedCallback
 * @param {Element} el
 * @returns {void}
 */

/**
 * @callback ElRemovedCallback
 * @param {Element} el
 * @returns {void}
 */

/**
 * @typedef {Element & {
 *   _x_attributeCleanups: {
 *     [name: string]: AttributeCleanupCallback[]
 *   },
 *   _x_ignoreMutationObserver?: boolean,
 * }} El
 */

let /** @type {AttributeAddedCallback[]} */ onAttributeAddeds = []
let /** @type {ElRemovedCallback[]} */ onElRemoveds = []
let /** @type {ElAddedCallback[]} */ onElAddeds = []

/**
 *
 * @param {ElAddedCallback} callback
 */
export function onElAdded(callback) {
    onElAddeds.push(callback)
}

/**
 *
 * @param {ElRemovedCallback} callback
 */
export function onElRemoved(callback) {
    onElRemoveds.push(callback)
}

/**
 *
 * @param {AttributeAddedCallback} callback
 */
export function onAttributesAdded(callback) {
    onAttributeAddeds.push(callback)
}

/**
 *
 * @param {El} el
 * @param {string} name
 * @param {AttributeCleanupCallback} callback
 */
export function onAttributeRemoved(el, name, callback) {
    if (!el._x_attributeCleanups) el._x_attributeCleanups = {}
    if (!el._x_attributeCleanups[name]) el._x_attributeCleanups[name] = []

    el._x_attributeCleanups[name].push(callback)
}

/**
 *
 * @param {El} el
 * @param {string[]} [names]
 * @returns
 */
export function cleanupAttributes(el, names) {
    if (!el._x_attributeCleanups) return

    Object.entries(el._x_attributeCleanups).forEach(([name, value]) => {
        ;(names === undefined || names.includes(name)) && value.forEach(i => i())

        delete el._x_attributeCleanups[name]
    })
}

let observer = new MutationObserver(onMutate)

let currentlyObserving = false

export function startObservingMutations() {
    observer.observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
    })

    currentlyObserving = true
}

export function stopObservingMutations() {
    observer.disconnect()

    currentlyObserving = false
}

let /** @type {MutationRecord[]} */ recordQueue = []
let willProcessRecordQueue = false

export function flushObserver() {
    recordQueue = recordQueue.concat(observer.takeRecords())

    if (recordQueue.length && !willProcessRecordQueue) {
        willProcessRecordQueue = true

        queueMicrotask(() => {
            processRecordQueue()

            willProcessRecordQueue = false
        })
    }
}

function processRecordQueue() {
    onMutate(recordQueue)

    recordQueue.length = 0
}

/**
 * @template T
 * @callback MutateDomCallback<T>
 * @returns {T}
 */

/**
 * @template T
 * @param {MutateDomCallback<T>} callback
 * @returns
 */
export function mutateDom(callback) {
    if (!currentlyObserving) return callback()

    flushObserver()

    stopObservingMutations()

    let result = callback()

    startObservingMutations()

    return result
}

/**
 * @type {MutationCallback}
 */
function onMutate(mutations) {
    let /** @type {Node[] | null} */ addedNodes = []
    let /** @type {Node[] | null} */ removedNodes = []
    let /** @type {Map<El, Attribute[]> | null} */ addedAttributes = new Map()
    let /** @type {Map<El, string[]> | null} */ removedAttributes = new Map()

    for (let i = 0; i < mutations.length; i++) {
        if (/** @type {El} */ (mutations[i].target)._x_ignoreMutationObserver) continue

        if (mutations[i].type === 'childList') {
            mutations[i].addedNodes.forEach(node => node.nodeType === 1 && addedNodes?.push(node))
            mutations[i].removedNodes.forEach(
                node => node.nodeType === 1 && removedNodes?.push(node),
            )
        }

        if (mutations[i].type === 'attributes') {
            // TODO: check if these assertions are always valid
            let el = /** @type {El} */ (mutations[i].target)
            let name = /** @type {string} */ (mutations[i].attributeName)
            let oldValue = mutations[i].oldValue

            let add = () => {
                if (!addedAttributes?.has(el)) addedAttributes?.set(el, [])

                addedAttributes?.get(el)?.push({ name, value: el.getAttribute(name) })
            }

            let remove = () => {
                if (!removedAttributes?.has(el)) removedAttributes?.set(el, [])

                removedAttributes?.get(el)?.push(name)
            }

            // New attribute.
            if (el.hasAttribute(name) && oldValue === null) {
                add()
                // Changed atttribute.
            } else if (el.hasAttribute(name)) {
                remove()
                add()
                // Removed atttribute.
            } else {
                remove()
            }
        }
    }

    removedAttributes.forEach((attrs, el) => {
        cleanupAttributes(el, attrs)
    })

    addedAttributes.forEach((attrs, el) => {
        onAttributeAddeds.forEach(i => i(el, attrs))
    })

    for (let node of addedNodes) {
        // If an element gets moved on a page, it's registered
        // as both an "add" and "remove", so we wan't to skip those.
        if (removedNodes.includes(node)) continue

        onElAddeds.forEach(i => i(/** @type {El} */ (node)))
    }

    for (let node of removedNodes) {
        // If an element gets moved on a page, it's registered
        // as both an "add" and "remove", so we want to skip those.
        if (addedNodes.includes(node)) continue

        onElRemoveds.forEach(i => i(/** @type {El} */ (node)))
    }

    addedNodes = null
    removedNodes = null
    addedAttributes = null
    removedAttributes = null
}
