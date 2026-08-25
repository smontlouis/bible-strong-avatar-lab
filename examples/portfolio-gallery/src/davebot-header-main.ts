import { createAvatar } from '@bible-strong/avatar-web'

import { davebotHeaderVariants } from './davebot-header'
import { createGazeTracker, loadGazeSettings } from './davebotGaze'
import './davebot-header.css'

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Values tuned in davebot-gaze.html are persisted, so the header reflects
// whatever feel was last chosen in the lab.
const gaze = createGazeTracker(loadGazeSettings())

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

  if (!gaze.track(mount)) {
    throw new Error(`Davebot eye paths for ${variant.mode} mode were not found.`)
  }
}
