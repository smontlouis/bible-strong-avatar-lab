import { createAvatar } from '@bible-strong/avatar-web'

import { EMOTE_LABELS } from './builder'
import { ghosts, type GhostVariant } from './ghosts'
import './ghosts.css'

const grid = document.querySelector<HTMLElement>('#grid')
if (!grid) throw new Error('Ghost grid was not found.')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const buildCard = (ghost: GhostVariant, index: number) => {
  const card = document.createElement('article')
  card.className = `card is-${ghost.mode}`
  card.style.setProperty('--ground', ghost.ground)
  card.style.setProperty('--accent', ghost.accent)
  card.style.setProperty('--i', String(index))

  const tile = document.createElement('div')
  tile.className = 'tile'
  const mount = document.createElement('div')
  mount.className = 'avatar'
  tile.appendChild(mount)

  const meta = document.createElement('div')
  meta.className = 'meta'
  const name = document.createElement('h2')
  name.textContent = ghost.name
  const tail = document.createElement('p')
  tail.className = 'note'
  tail.textContent = ghost.tail
  const token = document.createElement('p')
  token.className = 'token'
  token.textContent = `${ghost.role} · ${EMOTE_LABELS[ghost.signature].toUpperCase()}`
  meta.append(name, tail, token)

  card.append(tile, meta)
  grid.appendChild(card)

  // `createAvatar` throws on an invalid definition (for example more than the
  // 16 body nodes the schema allows). Contain it per card so one bad ghost
  // cannot stop the rest of the grid from rendering.
  let controller
  try {
    controller = createAvatar(mount, {
      definition: ghost.definition,
      defaultAnimation: reduceMotion ? undefined : 'idle',
      autoplay: !reduceMotion,
      size: '100%',
      ariaLabel: `${ghost.name}, a ghost — ${ghost.tail}`,
      onError: error => console.error(`[ghost:${ghost.id}]`, error),
    })
  } catch (error) {
    console.error(`[ghost:${ghost.id}] failed to build`, error)
    card.classList.add('is-failed')
    return
  }

  if (reduceMotion) controller.setExpression('neutral')

  // Hover plays each ghost's own signature emote. The engine's slowDrift keeps
  // them bobbing at rest, so no CSS float is layered on top of it.
  if (!reduceMotion) {
    card.addEventListener('pointerenter', () => controller.play(ghost.signature))
    card.addEventListener('pointerleave', () => controller.play('idle'))
  }
}

ghosts.forEach(buildCard)
