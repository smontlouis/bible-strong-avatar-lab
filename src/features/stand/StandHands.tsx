import { motion, useMotionValue } from 'motion/react'
import { useEffect, useEffectEvent, useState, type RefObject } from 'react'
import { useStudioLanguage } from '@/i18n'
import type { createStandDirector, StandObservation } from './standDirector'
import type { createParticleField } from './standParticles'
import { fistPath, openHandPath } from './StandPictogram'
import {
  createHandNavigation,
  type HandFrame,
  type HandMode,
  type HandRect,
  type HandTarget,
} from './standHandNavigation'

export type HandStatus = { mode: HandMode; hover: string | null }

// A short hint that travels with the cursor, where the visitor is already looking.
const cursorHints: Partial<Record<HandMode, string>> = {
  selecting: 'Ferme le poing',
  closed: 'Rouvre la main',
  grabbing: 'Glisse pour défiler',
}

export function StandHands({
  root,
  observation,
  director,
  mirror,
  reader,
  enabled,
  onAction,
  onStatus,
  particles,
  reducedMotion,
  sign,
}: {
  root: RefObject<HTMLElement | null>
  observation: RefObject<StandObservation | null>
  director: ReturnType<typeof createStandDirector>
  mirror: boolean
  reader: string | null
  enabled: boolean
  onAction: (action: string) => void
  onStatus: (status: HandStatus) => void
  particles: ReturnType<typeof createParticleField>
  reducedMotion: boolean
  // Written every frame for the diagnostics; never React state.
  sign?: RefObject<HandFrame['sign']>
}) {
  const { t } = useStudioLanguage()
  const x = useMotionValue(0),
    y = useMotionValue(0),
    opacity = useMotionValue(0)
  const [cursor, setCursor] = useState<HandStatus>({ mode: 'hidden', hover: null })
  const current = useEffectEvent(() => ({
    mirror,
    reader,
    enabled,
    onAction,
    onStatus,
    reducedMotion,
  }))
  useEffect(() => {
    const navigation = createHandNavigation()
    let frame = 0,
      measuredAt = -Infinity,
      absentAt: number | null = null,
      lastVisitor = 0
    let heartAt = -Infinity
    // The drawn cursor glides onto a snapped control and back to the hand.
    let pull = 0,
      pullCenter = { x: 0, y: 0 },
      previousAt = performance.now()
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
      if (sign) sign.current = next.sign
      const dt = Math.min(100, Math.max(0, at - previousAt))
      previousAt = at
      if (next.snap)
        pullCenter = {
          x: next.snap.x + next.snap.width / 2,
          y: next.snap.y + next.snap.height / 2,
        }
      pull += ((next.snap ? 1 : 0) - pull) * (1 - Math.exp(-dt / 45))
      // Most of the way to the centre, so the hand still visibly moves the cursor.
      const shown = {
        x: next.point.x + (pullCenter.x - next.point.x) * pull * 0.85,
        y: next.point.y + (pullCenter.y - next.point.y) * pull * 0.85,
      }
      x.set(shown.x)
      y.set(shown.y)
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
        setCursor({ mode: next.mode, hover: next.hover })
        props.onStatus({ mode: next.mode, hover: next.hover })
      }
      if (next.scrollDelta && scroller) scroller.scrollTop += next.scrollDelta
      if (props.enabled && !props.reducedMotion) {
        if (next.mode === 'petting' && at - heartAt > 170) {
          heartAt = at
          particles.burst('heart', next.point.x + (Math.random() - 0.5) * 40, next.point.y - 34)
        }
        if (next.activate) particles.burst('click', shown.x, shown.y)
      }
      if (next.activate) props.onAction(next.activate)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      director.setHandRotation(null)
      director.setHandInteraction(performance.now(), false)
      current().onStatus({ mode: 'hidden', hover: null })
    }
  }, [director, observation, root, x, y, opacity, particles, sign])
  const mode = cursor.mode
  // A fist over a control is a click in progress, not a stray grip.
  const hint = mode === 'closed' && cursor.hover ? undefined : cursorHints[mode]
  return (
    <motion.div
      className="stand-hand-cursor"
      data-mode={mode}
      style={{ x, y, opacity }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="44" className="stand-hand-ring" />
        <path
          className="stand-hand-shape"
          d={
            mode === 'grabbing' || mode === 'rotating' || mode === 'closed'
              ? fistPath
              : openHandPath
          }
        />
      </svg>
      {hint && <span className="stand-hand-hint">{t(hint)}</span>}
    </motion.div>
  )
}
