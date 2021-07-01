import { scheduler } from './scheduler'

/**
 * @typedef {import('@vue/reactivity')} Reactivity
 * @typedef {Reactivity['reactive']} EngineReactive
 * @typedef {Reactivity['effect']} EngineEffect
 * @typedef {Reactivity['stop']} EngineRelease
 * @typedef {Reactivity['toRaw']} EngineRaw
 *
 * @typedef {object} Engine
 * @prop {EngineReactive} reactive
 * @prop {EngineEffect} effect
 * @prop {EngineRelease} release
 * @prop {EngineRaw} raw
 */

let /** @type {EngineReactive | undefined} */ reactive
let /** @type {EngineEffect | undefined} */ effect
let /** @type {EngineRelease | undefined} */ release
let /** @type {EngineRaw | undefined} */ raw

let shouldSchedule = true
/**
 *
 * @param {() => void} callback
 */
export function disableEffectScheduling(callback) {
    shouldSchedule = false

    callback()

    shouldSchedule = true
}

/**
 *
 * @param {Engine} engine
 */
export function setReactivityEngine(engine) {
    reactive = engine.reactive
    release = engine.release
    effect = callback =>
        engine.effect(callback, {
            scheduler: task => {
                if (shouldSchedule) {
                    scheduler(task)
                } else {
                    task()
                }
            },
        })
    raw = engine.raw
}

/**
 *
 * @param {EngineEffect} override
 */
export function overrideEffect(override) {
    effect = override
}

/**
 *
 * @param {Element & {
 *   _x_effects: Set<() => void>,
 *   _x_runEffects: () => void,
 * }} el
 * @returns {[(callback: () => void) => void, () => void]}
 */
export function elementBoundEffect(el) {
    let cleanup = () => {}

    let wrappedEffect = (/** @type {() => void} */ callback) => {
        // TODO: is this assertion always valid?
        let effectReference = /** @type {EngineEffect} */ (effect)(callback)

        if (!el._x_effects) {
            el._x_effects = new Set()

            // Livewire depends on el._x_runEffects.
            el._x_runEffects = () => {
                el._x_effects.forEach(i => i())
            }
        }

        el._x_effects.add(effectReference)

        cleanup = () => {
            if (effectReference === undefined) return

            el._x_effects.delete(effectReference)

            release?.(effectReference)
        }
    }

    return [
        wrappedEffect,
        () => {
            cleanup()
        },
    ]
}

export { release, reactive, effect, raw }
