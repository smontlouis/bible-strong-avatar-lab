import { motion, useMotionValue } from 'motion/react'
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react'
import type { StudioAvatar } from '@/features/avatar/avatars'
import { defaultExpression } from '@/features/avatar/presets'
import { StandFigure, type FigurePose } from './StandAvatar'
import {
  placeCompanions,
  sampleCompanion,
  type Companion,
  type createStandCrowd,
} from './standCrowd'

type Placement = { companion: Companion; x: number; screenX: number }
// Kept in sync with `--stand-companion-size` and the explore scale in standStage.css.
const SIZE = 0.44
const EXPLORE_SCALE = 0.74
// Share of the view box taken by a typical body (ears and bodies included),
// to keep characters apart.
const HEAD = 0.72

/** Other characters, one per additional visitor, each looking at its own person. */
export function StandCompanions({
  crowd,
  avatars,
  exploring,
  hidden,
  mirror,
  reducedMotion,
  root,
  onCount,
}: {
  crowd: ReturnType<typeof createStandCrowd>
  avatars: StudioAvatar[]
  exploring: boolean
  hidden: boolean
  mirror: boolean
  reducedMotion: boolean
  root: RefObject<HTMLElement | null>
  onCount: (count: number) => void
}) {
  const layer = useRef<HTMLDivElement>(null)
  const placements = useRef(new Map<number, Placement>())
  const [roster, setRoster] = useState<{ slot: number; trackId: number }[]>([])
  const read = useEffectEvent(() => ({ exploring, mirror, onCount }))
  useEffect(() => {
    let frame = 0
    let measuredAt = -Infinity
    let head = { center: 0, half: 0 }
    let key = ''
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      const element = layer.current
      if (!element || document.hidden) return
      const props = read()
      const companions = crowd.sample(at)
      const nextKey = companions.map(c => `${c.slot}:${c.trackId}`).join()
      if (nextKey !== key) {
        key = nextKey
        setRoster(companions.map(c => ({ slot: c.slot, trackId: c.trackId })))
        props.onCount(companions.filter(c => c.leftAt === null).length)
      }
      const bounds = element.getBoundingClientRect()
      if (at - measuredAt > 250) {
        measuredAt = at
        const box = root.current?.querySelector('[data-stand-pet-target]')?.getBoundingClientRect()
        if (box?.width) head = { center: box.x + box.width / 2 - bounds.x, half: box.width / 2 }
      }
      const size = window.innerHeight * SIZE * (props.exploring ? EXPLORE_SCALE : 1)
      const center = head.center || bounds.width / 2
      const next = placeCompanions(companions, {
        mirror: props.mirror,
        exploring: props.exploring,
        width: bounds.width,
        center,
        // Exploring: tuck behind the shoulders. Otherwise: stay clear of the character.
        clearance: props.exploring ? head.half + size * HEAD * 0.22 : head.half + 40,
        size: size * HEAD,
        previous: new Map([...placements.current].map(([slot, placement]) => [slot, placement.x])),
      })
      placements.current = new Map(
        next.map(placement => [
          placement.slot,
          {
            companion: companions.find(c => c.slot === placement.slot)!,
            x: placement.x,
            screenX: placement.x / Math.max(1, bounds.width),
          },
        ])
      )
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [crowd, root])
  return (
    <div className="stand-companions" ref={layer} aria-hidden="true">
      {roster.map(
        ({ slot, trackId }) =>
          avatars[slot] && (
            <CompanionFigure
              key={`${slot}:${trackId}`}
              avatar={avatars[slot]}
              slot={slot}
              placements={placements}
              exploring={exploring}
              hidden={hidden}
              mirror={mirror}
              reducedMotion={reducedMotion}
            />
          )
      )}
    </div>
  )
}

function CompanionFigure({
  avatar,
  slot,
  placements,
  exploring,
  hidden,
  mirror,
  reducedMotion,
}: {
  avatar: StudioAvatar
  slot: number
  placements: RefObject<Map<number, Placement>>
  exploring: boolean
  hidden: boolean
  mirror: boolean
  reducedMotion: boolean
}) {
  const x = useMotionValue(0)
  const placed = useRef(false)
  const opacity = useMotionValue(0)
  const scale = useMotionValue(0.6)
  const neutral = { ...defaultExpression, ...avatar.eyes }
  const pose = (at: number): FigurePose | null => {
    const placement = placements.current.get(slot)
    if (!placement) return null
    const next = sampleCompanion(placement.companion, at, neutral, {
      mirror,
      reducedMotion,
      screenX: placement.screenX,
    })
    // Glide towards the person rather than jumping with tracking noise.
    x.set(placed.current ? x.get() + (placement.x - x.get()) * 0.14 : placement.x)
    placed.current = true
    const presence = hidden ? 0 : next.presence
    opacity.set(presence)
    scale.set((0.6 + 0.4 * presence) * (exploring ? EXPLORE_SCALE : 1))
    return {
      expression: next.expression,
      blink: next.blink,
      x: 0,
      y: next.y,
      scale: next.scale,
      glow: 0.2 + 0.3 * presence,
    }
  }
  return (
    <motion.div className="stand-companion" style={{ x, opacity, scale }}>
      <StandFigure avatar={avatar} pose={pose} fps={20} grounded />
      <span className="stand-companion-name">{avatar.name}</span>
    </motion.div>
  )
}
