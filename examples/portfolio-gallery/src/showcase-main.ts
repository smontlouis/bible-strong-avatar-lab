import { createAvatar } from '@bible-strong/avatar-web'

import { EMOTES, EMOTE_LABELS, type Character, type EmoteKey } from './builder'
import { showcase } from './showcase'
import './showcase.css'

const grid = document.querySelector<HTMLElement>('#grid')
if (!grid) throw new Error('Showcase grid was not found.')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// surface-motion: blur-mask crossfade when the emote label text changes.
const swapLabel = (label: HTMLElement, text: string) => {
  if (reduceMotion) {
    label.textContent = text
    return
  }
  label.style.opacity = '0'
  label.style.filter = 'blur(4px)'
  window.setTimeout(() => {
    label.textContent = text
    label.style.opacity = '1'
    label.style.filter = 'blur(0px)'
  }, 120)
}

const buildCard = (character: Character, index: number) => {
  const card = document.createElement('article')
  card.className = 'card show-card'
  card.style.setProperty('--accent', character.accent)
  card.style.setProperty('--i', String(index))

  const tile = document.createElement('div')
  tile.className = 'tile'
  const mount = document.createElement('div')
  mount.className = 'avatar'
  tile.appendChild(mount)

  const meta = document.createElement('div')
  meta.className = 'meta'
  const name = document.createElement('h2')
  name.textContent = character.name
  const role = document.createElement('p')
  role.textContent = character.role
  meta.append(name, role)

  const now = document.createElement('p')
  now.className = 'now'
  now.textContent = reduceMotion ? 'Paused' : `Now · ${EMOTE_LABELS.idle}`

  const chips = document.createElement('div')
  chips.className = 'chips'

  card.append(tile, meta, now, chips)
  grid.appendChild(card)

  const controller = createAvatar(mount, {
    definition: character.definition,
    defaultAnimation: reduceMotion ? undefined : 'idle',
    autoplay: !reduceMotion,
    size: '100%',
    ariaLabel: `${character.name} — ${character.role}`,
    onError: error => console.error(`[${character.id}]`, error),
  })
  if (reduceMotion) controller.setExpression('neutral')

  // Chip state: `pinned` is the emote the user explicitly selected. Hover only
  // previews the signature emote while nothing is pinned.
  let pinned: EmoteKey | null = null

  const setActiveChip = (active: EmoteKey) => {
    for (const button of chips.querySelectorAll<HTMLButtonElement>('.chip')) {
      button.setAttribute('aria-pressed', String(button.dataset.emote === active))
    }
  }

  const play = (emote: EmoteKey) => {
    const result = controller.play(emote)
    if (!result.ok) {
      console.error(`[${character.id}] play(${emote})`, result.error)
      return
    }
    swapLabel(now, `Now · ${EMOTE_LABELS[emote]}`)
    setActiveChip(emote)
  }

  for (const emote of EMOTES) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip'
    chip.dataset.emote = emote
    chip.textContent = EMOTE_LABELS[emote]
    chip.setAttribute('aria-pressed', String(emote === 'idle' && !reduceMotion))
    if (emote === character.signature) chip.classList.add('is-signature')
    chip.addEventListener('click', () => {
      pinned = emote === 'idle' ? null : emote
      play(emote)
    })
    chips.appendChild(chip)
  }

  // surface-interaction: the hovered card is the focal one (it lifts and plays
  // its signature). We deliberately do NOT dim the rest of the grid — at
  // gallery hover frequency that fails the 50-use test.
  if (!reduceMotion) {
    card.addEventListener('pointerenter', () => {
      if (!pinned) play(character.signature)
    })
    card.addEventListener('pointerleave', () => {
      if (!pinned) play('idle')
    })
  }
}

showcase.forEach(buildCard)
