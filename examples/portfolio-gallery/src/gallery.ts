import { createAvatar } from '@bible-strong/avatar-web'

import type { Character } from './builder'

export const renderGallery = (mountSelector: string, characters: Character[]): void => {
  const grid = document.querySelector<HTMLElement>(mountSelector)
  if (!grid) throw new Error(`Gallery grid '${mountSelector}' was not found.`)

  for (const character of characters) {
    const card = document.createElement('article')
    card.className = 'card'
    card.style.setProperty('--accent', character.accent)

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

    card.append(tile, meta)
    grid.appendChild(card)

    const controller = createAvatar(mount, {
      definition: character.definition,
      defaultAnimation: 'idle',
      size: '100%',
      ariaLabel: `${character.name} — ${character.role}`,
      onError: error => console.error(`[${character.id}]`, error),
    })

    card.addEventListener('pointerenter', () => controller.play('hello'))
    card.addEventListener('pointerleave', () => controller.play('idle'))
  }
}
