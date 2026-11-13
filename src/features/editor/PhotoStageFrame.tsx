import { motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useEffectEvent, useRef, type CSSProperties, type ReactNode } from 'react'

import { useStudioLanguage } from '@/i18n'

import type { PhotoTool, SnapshotBackground } from '@/features/editor/utils'
import {
  normalizeSnapshotComposition,
  type SnapshotComposition,
} from '@/features/editor/snapshotComposition'

export function PhotoStageFrame({
  background,
  children,
  colorFrom,
  colorTo,
  composition,
  onCompositionChange,
  tool,
}: {
  background: SnapshotBackground
  children: ReactNode
  colorFrom: string
  colorTo: string
  composition: SnapshotComposition
  onCompositionChange: (composition: SnapshotComposition) => void
  tool: PhotoTool
}) {
  const { t } = useStudioLanguage()
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    clientX: number
    clientY: number
    x: number
    y: number
  } | null>(null)
  const wheelCommitRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const positionX = useMotionValue(composition.x)
  const positionY = useMotionValue(composition.y)
  const scale = useMotionValue(composition.scale)
  const translatedX = useTransform(positionX, value => `${value / 3}%`)
  const translatedY = useTransform(positionY, value => `${value / 3}%`)
  const backgroundValue =
    background === 'solid'
      ? colorFrom
      : background === 'linear'
        ? `linear-gradient(135deg, ${colorFrom}, ${colorTo})`
        : background === 'radial'
          ? `radial-gradient(circle at 50% 42%, ${colorFrom}, ${colorTo})`
          : undefined

  useEffect(() => {
    positionX.set(composition.x)
    positionY.set(composition.y)
    scale.set(composition.scale)
  }, [composition.x, composition.y, composition.scale, positionX, positionY, scale])

  const commitComposition = useEffectEvent(() => {
    onCompositionChange(
      normalizeSnapshotComposition({
        ...composition,
        x: positionX.get(),
        y: positionY.get(),
        scale: scale.get(),
      })
    )
  })

  const zoomFrame = useEffectEvent((event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (dragRef.current) return
    scale.set(
      normalizeSnapshotComposition({
        ...composition,
        scale: scale.get() * Math.exp(-event.deltaY * 0.0015),
      }).scale
    )
    if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    wheelCommitRef.current = setTimeout(commitComposition, 120)
  })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || tool !== 'frame') return
    frame.addEventListener('wheel', zoomFrame, { passive: false })
    return () => {
      frame.removeEventListener('wheel', zoomFrame)
      if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    }
  }, [tool])

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    if (wheelCommitRef.current) clearTimeout(wheelCommitRef.current)
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: positionX.get(),
      y: positionY.get(),
    }
    event.currentTarget.dataset.dragging = 'true'
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const viewBoxPerPixel = 300 / Math.max(bounds.width, 1)
    positionX.set(
      normalizeSnapshotComposition({
        ...composition,
        x: dragRef.current.x + (event.clientX - dragRef.current.clientX) * viewBoxPerPixel,
      }).x
    )
    positionY.set(
      normalizeSnapshotComposition({
        ...composition,
        y: dragRef.current.y + (event.clientY - dragRef.current.clientY) * viewBoxPerPixel,
      }).y
    )
  }

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    delete event.currentTarget.dataset.dragging
    commitComposition()
  }

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const distance = event.shiftKey ? 10 : 2
    if (event.key === 'ArrowLeft') positionX.set(positionX.get() - distance)
    else if (event.key === 'ArrowRight') positionX.set(positionX.get() + distance)
    else if (event.key === 'ArrowUp') positionY.set(positionY.get() - distance)
    else if (event.key === 'ArrowDown') positionY.set(positionY.get() + distance)
    else if (event.key === '+' || event.key === '=') scale.set(scale.get() + 0.05)
    else if (event.key === '-') scale.set(scale.get() - 0.05)
    else return
    event.preventDefault()
    commitComposition()
  }

  return (
    <div
      ref={frameRef}
      className={`photo-live-frame${background === 'transparent' ? ' is-transparent' : ''}${tool === 'frame' ? ' is-frame-tool' : ''}`}
      style={
        {
          '--photo-corner-radius': `${composition.cornerRadius}%`,
          ...(backgroundValue ? { background: backgroundValue } : {}),
        } as CSSProperties
      }
    >
      <motion.div className="photo-live-avatar" style={{ x: translatedX, y: translatedY, scale }}>
        {children}
      </motion.div>
      {tool === 'frame' && (
        <div
          className="photo-frame-interaction"
          role="application"
          tabIndex={0}
          aria-label={t(
            'Cadre du logo. Glisse pour déplacer l’avatar et utilise la molette pour zoomer.'
          )}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onKeyDown={nudge}
        />
      )}
    </div>
  )
}
