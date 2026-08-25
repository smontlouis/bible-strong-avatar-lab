import { createAvatar } from '@bible-strong/avatar-web'

import { crewMembers, type CrewMember } from './crew'
import './crew.css'

const grid = document.querySelector<HTMLElement>('#grid')
if (!grid) throw new Error('Crew grid was not found.')

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const buildCard = (member: CrewMember, index: number): void => {
  const card = document.createElement('article')
  card.className = 'card'
  card.style.setProperty('--i', String(index))

  const pairRow = document.createElement('div')
  pairRow.className = 'pair'

  for (const variant of member.variants) {
    // Each tile carries its own mode scope, so the seven roles resolve from the
    // mode rather than from anything the card overrides locally.
    const tile = document.createElement('div')
    tile.className = 'tile'
    tile.dataset.mode = variant.mode

    const mount = document.createElement('div')
    mount.className = 'avatar'
    tile.append(mount)

    const modeTag = document.createElement('span')
    modeTag.className = 'mode-tag'
    modeTag.textContent = variant.mode
    tile.append(modeTag)

    pairRow.append(tile)

    // Inferred (not annotated `| undefined`) so the narrowing after the catch
    // survives into the hover closures, matching the sibling gallery pages.
    let controller
    try {
      controller = createAvatar(mount, {
        definition: variant.definition,
        defaultAnimation: reduceMotion ? undefined : 'idle',
        autoplay: !reduceMotion,
        size: '100%',
        ariaLabel: `${member.name}, a ghost in ${variant.mode} mode — ${member.note}`,
        onError: error => console.error(`[${member.id}/${variant.mode}]`, error),
      })
    } catch (error) {
      tile.classList.add('is-failed')
      tile.dataset.error = error instanceof Error ? error.message : String(error)
      continue
    }

    // Hover the whole card so both modes react together — the point of the
    // pairing is that structure is identical and only value changes.
    if (!reduceMotion) {
      card.addEventListener('pointerenter', () => controller.play('curious'))
      card.addEventListener('pointerleave', () => controller.play('idle'))
    }
  }

  const meta = document.createElement('div')
  meta.className = 'meta'

  const name = document.createElement('h2')
  name.textContent = member.name

  const ratio = document.createElement('span')
  ratio.className = 'ratio'
  ratio.textContent = member.ratio
  name.append(ratio)

  const note = document.createElement('p')
  note.className = 'note'
  note.textContent = member.note

  const metrics = document.createElement('p')
  metrics.className = 'metrics'
  metrics.textContent = member.metrics

  meta.append(name, note, metrics)
  card.append(pairRow, meta)
  grid.append(card)
}

crewMembers.forEach(buildCard)
