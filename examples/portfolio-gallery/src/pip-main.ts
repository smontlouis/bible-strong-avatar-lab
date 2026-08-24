import { createAvatar } from '@bible-strong/avatar-web'

import { pipVariants, type PipVariant } from './pip'
import './pip.css'

const grid = document.querySelector<HTMLElement>('#grid')
if (!grid) throw new Error('Pip variation grid was not found.')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const buildCard = (variant: PipVariant, index: number) => {
  const card = document.createElement('article')
  card.className = `card is-${variant.mode}`
  card.style.setProperty('--ground', variant.ground)
  card.style.setProperty('--accent', variant.accent)
  card.style.setProperty('--i', String(index))

  const tile = document.createElement('div')
  tile.className = 'tile'
  const mount = document.createElement('div')
  mount.className = 'avatar'
  tile.appendChild(mount)

  const meta = document.createElement('div')
  meta.className = 'meta'
  const name = document.createElement('h2')
  name.textContent = variant.name
  const token = document.createElement('p')
  token.className = 'token'
  token.textContent = variant.role
  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = variant.note
  meta.append(name, token, note)

  card.append(tile, meta)
  grid.appendChild(card)

  const controller = createAvatar(mount, {
    definition: variant.definition,
    defaultAnimation: reduceMotion ? undefined : 'idle',
    autoplay: !reduceMotion,
    size: '100%',
    ariaLabel: `Pip in ${variant.name} — ${variant.role}`,
    onError: error => console.error(`[pip:${variant.id}]`, error),
  })
  if (reduceMotion) controller.setExpression('neutral')

  // Hover previews Pip's signature emote. The hovered card is the focal one;
  // the rest of the grid is left alone (dimming every sibling on a hover this
  // frequent fails the 50-use test).
  if (!reduceMotion) {
    card.addEventListener('pointerenter', () => controller.play('curious'))
    card.addEventListener('pointerleave', () => controller.play('idle'))
  }
}

pipVariants.forEach(buildCard)
