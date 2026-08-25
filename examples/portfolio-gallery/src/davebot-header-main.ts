import { createAvatar } from '@bible-strong/avatar-web'

import { davebotHeaderVariants } from './davebot-header'
import './davebot-header.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const maxGazeOffset = reduceMotion ? 6 : 9
const fullGazeDistance = 240

type GazeTarget = {
  mount: HTMLElement
  left: SVGTransform
  right: SVGTransform
  centerX: number
  centerY: number
}

const gazeTargets: GazeTarget[] = []

for (const variant of davebotHeaderVariants) {
  const panel = document.querySelector<HTMLElement>(`.portfolio[data-mode="${variant.mode}"]`)
  const mount = panel?.querySelector<HTMLElement>('[data-davebot-avatar]')
  if (!panel || !mount) throw new Error(`Davebot mount for ${variant.mode} mode was not found.`)

  const controller = createAvatar(mount, {
    definition: variant.definition,
    defaultAnimation: reduceMotion ? undefined : 'idle',
    autoplay: !reduceMotion,
    size: '100%',
    ariaLabel: `Davebot, the portfolio guide in ${variant.mode} mode`,
    onError: error => console.error(`[davebot-header/${variant.mode}]`, error),
  })

  if (reduceMotion) controller.setExpression('neutral')

  const davebot = panel.querySelector<HTMLElement>('[data-davebot]')
  if (!davebot) throw new Error(`Davebot control for ${variant.mode} mode was not found.`)

  davebot.addEventListener('pointerenter', () => controller.play('curious'))
  davebot.addEventListener('pointerleave', () => controller.play('idle'))
  davebot.addEventListener('focus', () => controller.play('curious'))
  davebot.addEventListener('blur', () => controller.play('idle'))
  davebot.addEventListener('click', () => controller.play('hello'))

  const svg = mount.querySelector<SVGSVGElement>('.bs-avatar svg')
  const eyePaths = svg?.querySelectorAll<SVGPathElement>('g[clip-path] > path')
  if (!svg || !eyePaths || eyePaths.length !== 2) {
    throw new Error(`Davebot eye paths for ${variant.mode} mode were not found.`)
  }

  // The engine repaints each eye's path data during blinks and expressions, but
  // does not touch this SVG transform list. One persistent transform per eye
  // therefore layers high-frequency gaze over normal playback without
  // regenerating paths or resetting the animation timeline.
  const left = svg.createSVGTransform()
  const right = svg.createSVGTransform()
  left.setTranslate(0, 0)
  right.setTranslate(0, 0)
  // Chromium clones both the appended object and appendItem's return value.
  // Only getItem() yields a live transform handle whose later setTranslate()
  // calls update the eye path.
  eyePaths[0].transform.baseVal.appendItem(left)
  eyePaths[1].transform.baseVal.appendItem(right)
  const attachedLeft = eyePaths[0].transform.baseVal.getItem(0)
  const attachedRight = eyePaths[1].transform.baseVal.getItem(0)
  gazeTargets.push({ mount, left: attachedLeft, right: attachedRight, centerX: 0, centerY: 0 })
}

let pointerX = 0
let pointerY = 0
let pointerPresent = false
let geometryDirty = true
let gazeFrame: number | null = null

const updateCenters = (): void => {
  for (const target of gazeTargets) {
    const rect = target.mount.getBoundingClientRect()
    target.centerX = rect.left + rect.width / 2
    target.centerY = rect.top + rect.height / 2
  }
  geometryDirty = false
}

const paintGaze = (): void => {
  gazeFrame = null
  if (geometryDirty) updateCenters()

  for (const target of gazeTargets) {
    let x = 0
    let y = 0
    if (pointerPresent) {
      const deltaX = pointerX - target.centerX
      const deltaY = pointerY - target.centerY
      const distance = Math.hypot(deltaX, deltaY)
      if (distance > 0) {
        const offset = maxGazeOffset * Math.min(distance / fullGazeDistance, 1)
        x = (deltaX / distance) * offset
        y = (deltaY / distance) * offset
      }
    }
    target.left.setTranslate(x, y)
    target.right.setTranslate(x, y)
  }
}

const requestGazePaint = (): void => {
  if (gazeFrame === null) gazeFrame = requestAnimationFrame(paintGaze)
}

window.addEventListener(
  'pointermove',
  event => {
    if (event.pointerType === 'touch') return
    pointerX = event.clientX
    pointerY = event.clientY
    pointerPresent = true
    requestGazePaint()
  },
  { passive: true }
)

window.addEventListener('pointerout', event => {
  if (event.relatedTarget !== null) return
  pointerPresent = false
  requestGazePaint()
})

window.addEventListener('blur', () => {
  pointerPresent = false
  requestGazePaint()
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  pointerPresent = false
  requestGazePaint()
})

const markGeometryDirty = (): void => {
  geometryDirty = true
  requestGazePaint()
}

new ResizeObserver(markGeometryDirty).observe(document.documentElement)
window.addEventListener('scroll', markGeometryDirty, { passive: true })
