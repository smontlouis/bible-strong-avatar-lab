import { useEffect, useEffectEvent, useRef } from 'react'
import type { createParticleField, Particle } from './standParticles'

type ParticleField = ReturnType<typeof createParticleField>

const heart = new Path2D(
  'M0 0.34-0.36-0.02Q-0.5-0.18-0.38-0.34-0.2-0.5 0-0.28 0.2-0.5 0.38-0.34 0.5-0.18 0.36-0.02Z'
)
const star = new Path2D(
  Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 ? 0.22 : 0.5
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2
    return `${index ? 'L' : 'M'}${Math.cos(angle) * radius} ${Math.sin(angle) * radius}`
  }).join('') + 'Z'
)
const drop = new Path2D('M0-0.5Q0.34-0.02 0.34 0.18A0.34 0.34 0 0 1-0.34 0.18Q-0.34-0.02 0-0.5Z')
const sparkle = new Path2D(
  'M0-0.5Q0.06-0.06 0.5 0 0.06 0.06 0 0.5-0.06 0.06-0.5 0-0.06-0.06 0-0.5Z'
)

function draw(context: CanvasRenderingContext2D, particle: Particle) {
  const progress = particle.age / particle.life
  const fade =
    particle.kind === 'dust'
      ? Math.sin(progress * Math.PI) * 0.45
      : progress < 0.08
        ? progress / 0.08
        : 1 - ((progress - 0.08) / 0.92) ** 2
  context.globalAlpha = Math.max(0, fade)
  context.fillStyle = particle.color
  context.strokeStyle = particle.color
  context.save()
  context.translate(particle.x, particle.y)
  if (particle.kind === 'ring') {
    const eased = 1 - (1 - progress) ** 3
    context.lineWidth = 5 * (1 - progress) + 1
    context.beginPath()
    context.arc(0, 0, (particle.size / 2) * (0.25 + 0.75 * eased), 0, Math.PI * 2)
    context.stroke()
  } else if (particle.kind === 'dust') {
    context.beginPath()
    context.arc(0, 0, particle.size, 0, Math.PI * 2)
    context.fill()
  } else if (particle.kind === 'zzz') {
    context.rotate(-0.2)
    context.font = `800 ${particle.size}px Inter, ui-sans-serif, sans-serif`
    context.fillText('z', 0, 0)
  } else {
    context.rotate(particle.rotation)
    if (particle.kind === 'confetti') {
      // Flutter: the paper strip turns edge-on as it spins.
      context.scale(Math.cos(particle.rotation * 1.7), 1)
      context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2)
    } else {
      context.scale(particle.size, particle.size)
      // Hearts and drops stay nearly upright.
      if (particle.kind === 'heart' || particle.kind === 'drop')
        context.rotate(-particle.rotation * 0.85)
      context.fill(
        particle.kind === 'heart'
          ? heart
          : particle.kind === 'drop'
            ? drop
            : particle.kind === 'star'
              ? star
              : sparkle
      )
    }
  }
  context.restore()
}

/** One transparent canvas for bursts and ambient motes; never enters React state. */
export function StandEffects({
  field,
  reducedMotion,
}: {
  field: ParticleField
  reducedMotion: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const readReducedMotion = useEffectEvent(() => reducedMotion)
  useEffect(() => {
    let frame = 0
    let previous = performance.now()
    const tick = (at: number) => {
      frame = requestAnimationFrame(tick)
      const element = canvas.current
      const context = element?.getContext('2d')
      const dt = at - previous
      previous = at
      if (!element || !context || document.hidden) return
      const width = element.clientWidth,
        height = element.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (
        element.width !== Math.round(width * dpr) ||
        element.height !== Math.round(height * dpr)
      ) {
        element.width = Math.round(width * dpr)
        element.height = Math.round(height * dpr)
      }
      if (readReducedMotion()) field.clear()
      else field.ambient(width, height)
      field.step(dt)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      for (const particle of field.particles()) draw(context, particle)
      context.globalAlpha = 1
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [field])
  return <canvas className="stand-effects" ref={canvas} aria-hidden="true" />
}
