import { motion, useMotionValue } from 'motion/react'
import { useEffect, useEffectEvent, useState, type RefObject } from 'react'
import type { createStandDirector, StandObservation } from './standDirector'
import {
  createHandNavigation,
  type HandMode,
  type HandRect,
  type HandTarget,
} from './standHandNavigation'

export type HandStatus = { mode: HandMode; hover: string | null }

export function StandHands({
  root,
  observation,
  director,
  mirror,
  reader,
  enabled,
  onAction,
  onStatus,
}: {
  root: RefObject<HTMLElement | null>
  observation: RefObject<StandObservation | null>
  director: ReturnType<typeof createStandDirector>
  mirror: boolean
  reader: string | null
  enabled: boolean
  onAction: (action: string) => void
  onStatus: (status: HandStatus) => void
}) {
  const x = useMotionValue(0),
    y = useMotionValue(0),
    opacity = useMotionValue(0)
  const [mode, setMode] = useState<HandMode>('hidden')
  const current = useEffectEvent(() => ({ mirror, reader, enabled, onAction, onStatus }))
  useEffect(() => {
    const navigation = createHandNavigation()
    let frame = 0,
      measuredAt = -Infinity,
      absentAt: number | null = null,
      lastVisitor = 0
    let hadVisitor = false,
      previousMode: HandMode = 'hidden',
      previousHover: string | null = null
    let targets: HandTarget[] = [],
      petBounds: HandRect | null = null,
      scrollBounds: HandRect | null = null
    let scroller: HTMLElement | null = null
    let context = ''
    const rect = (element: Element | null): HandRect | null => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.height > 0
        ? { x: box.x, y: box.y, width: box.width, height: box.height }
        : null
    }
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      const props = current()
      const attention = director.inspect(at, props.mirror)
      const host = root.current
      if (!host) return
      const nextContext = props.enabled ? (props.reader ?? 'cards') : 'settings'
      if (context !== nextContext) {
        context = nextContext
        measuredAt = -Infinity
      }
      if (at - measuredAt > 100) {
        measuredAt = at
        targets = props.enabled
          ? Array.from(host.querySelectorAll<HTMLElement>('[data-stand-action]')).flatMap(
              element => {
                const bounds = rect(element)
                return bounds && !element.matches(':disabled, [aria-disabled="true"]')
                  ? [{ ...bounds, id: element.dataset.standAction! }]
                  : []
              }
            )
          : []
        petBounds =
          props.reader || !props.enabled
            ? null
            : rect(host.querySelector('[data-stand-pet-target]'))
        scroller = props.enabled ? host.querySelector<HTMLElement>('[data-stand-scroll]') : null
        scrollBounds = rect(scroller)
      }
      if (attention.visible) {
        if (hadVisitor && lastVisitor !== attention.visitorId && previousMode === 'hidden')
          props.onAction('reset')
        hadVisitor = true
        lastVisitor = attention.visitorId
        absentAt = null
      } else {
        if (absentAt === null) absentAt = at
        if (hadVisitor && previousMode === 'hidden' && at - absentAt > 8000) {
          props.onAction('reset')
          hadVisitor = false
        }
      }
      const next = navigation.sample({
        at,
        observation: document.hidden ? null : observation.current,
        visitor: attention.visible ? attention.target : null,
        visitorId: attention.visitorId,
        mirror: props.mirror,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        targets,
        petBounds,
        scrollBounds,
        context,
      })
      if (next.mode !== 'hidden') absentAt = null
      x.set(next.point.x)
      y.set(next.point.y)
      opacity.set(next.mode === 'hidden' || !props.enabled ? 0 : 1)
      director.setHandRotation(props.enabled ? next.rotation : null)
      director.setHandInteraction(
        at,
        props.enabled &&
          (Boolean(props.reader) ||
            next.hover !== null ||
            next.mode === 'petting' ||
            next.mode === 'rotating'),
        next.pet
      )
      // Paint only the changed target; coordinates never enter React state.
      if (previousHover !== next.hover) {
        host.querySelectorAll<HTMLElement>('[data-stand-action]').forEach(element => {
          element.dataset.handHover = String(element.dataset.standAction === next.hover)
        })
      }
      if (next.mode !== previousMode || next.hover !== previousHover) {
        previousMode = next.mode
        previousHover = next.hover
        setMode(next.mode)
        props.onStatus({ mode: next.mode, hover: next.hover })
      }
      if (next.scrollDelta && scroller) scroller.scrollTop += next.scrollDelta
      if (next.activate) props.onAction(next.activate)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      director.setHandRotation(null)
      director.setHandInteraction(performance.now(), false)
      current().onStatus({ mode: 'hidden', hover: null })
    }
  }, [director, observation, root, x, y, opacity])
  return (
    <motion.div
      className="stand-hand-cursor"
      data-mode={mode}
      style={{ x, y, opacity }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" className="stand-hand-ring" />
        {mode === 'grabbing' || mode === 'rotating' || mode === 'closed' ? (
          <path
            className="stand-hand-shape"
            d="M31 52V40q0-9 8-9 6 0 7 6v-3q0-9 8-8 7 0 7 9 2-7 8-5 7 1 7 9v18q0 19-21 20-18 0-23-14l-7-10q-4-7 2-10 5-2 9 6l5 6"
          />
        ) : (
          <path
            className="stand-hand-shape"
            d="M36 54 27 43q-5-6-10-2-4 4 1 10l14 22q6 10 22 10 21 0 23-21l3-23q1-7-5-7-6-1-7 6l-2 13 1-30q0-7-6-7-6 0-6 7l-1 28-3-34q-1-7-7-6-6 1-5 8l3 33-7-24q-2-7-8-5-6 2-4 9z"
          />
        )}
      </svg>
      {mode === 'petting' && (
        <span className="stand-pet-hearts">
          ♥ <i>♥</i> ♥
        </span>
      )}
    </motion.div>
  )
}
