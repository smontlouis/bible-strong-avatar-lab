import { describe, expect, it } from 'vitest'
import { createStandJourney, UNLOCK_DELAY_MS, UNLOCK_GRACE_MS } from '../standJourney'
import { bubbleCopy, invitationCopy } from '../standCopy'

const frame = (
  at: number,
  present: boolean,
  friendly = false,
  cue = present ? 'wave' : 'idle'
) => ({
  at,
  present,
  friendly,
  cue: cue as Parameters<ReturnType<typeof createStandJourney>['sample']>[0]['cue'],
  resources: true,
})

describe('stand journey', () => {
  it('attracts, approaches, plays, then unlocks the resources after a celebrated first gesture', () => {
    const journey = createStandJourney()
    expect(journey.sample(frame(0, false)).stage).toBe('attract')
    expect(journey.sample(frame(100, true, false, 'notice')).stage).toBe('approach')
    expect(journey.sample(frame(200, true, false, 'closer')).stage).toBe('approach')
    expect(journey.sample(frame(300, true, false, 'wave')).stage).toBe('play')
    expect(journey.sample(frame(400, true, true, 'hello')).stage).toBe('play')
    expect(journey.sample(frame(400 + UNLOCK_DELAY_MS - 1, true, true, 'hello')).stage).toBe('play')
    expect(journey.sample(frame(400 + UNLOCK_DELAY_MS, true, true, 'smile')).stage).toBe('explore')
  })

  it('keeps exploring through a short absence, then relocks for the next visitor', () => {
    const journey = createStandJourney()
    journey.sample(frame(0, true, true))
    journey.sample(frame(UNLOCK_DELAY_MS, true, true))
    expect(journey.sample(frame(3000, false)).stage).toBe('explore')
    expect(journey.sample(frame(3000 + UNLOCK_GRACE_MS, false)).stage).toBe('explore')
    expect(journey.sample(frame(3001 + UNLOCK_GRACE_MS, false)).stage).toBe('attract')
    expect(journey.sample(frame(12000, true, false, 'notice')).stage).toBe('approach')
  })

  it('never unlocks the resources when they are hidden, keeping free play', () => {
    const journey = createStandJourney()
    for (let at = 0; at <= 5000; at += 500)
      expect(
        journey.sample({ ...frame(at, true, true, 'free-play'), resources: false }).stage
      ).toBe('play')
  })

  it('does not unlock from a friendly flicker shorter than the celebration', () => {
    const journey = createStandJourney()
    journey.sample(frame(0, true, true))
    journey.sample(frame(500, true, false))
    expect(journey.sample(frame(UNLOCK_DELAY_MS + 100, true, true)).stage).toBe('play')
  })
})

describe('stand speech bubble', () => {
  it('lets replies win over hand hints and keeps social invitations when the hand is down', () => {
    expect(bubbleCopy('hello', 'explore', 'selecting', false)).toEqual(invitationCopy.hello)
    expect(bubbleCopy('smile', 'explore', 'hidden', false)).toEqual(invitationCopy.smile)
    expect(bubbleCopy('smile', 'explore', 'rotating', false)[0]).toBe('Wouhou, ça tourne !')
    expect(bubbleCopy('smile', 'explore', 'selecting', false)[0]).toBe('Oh, bon choix !')
    expect(bubbleCopy('tilt', 'explore', 'moving', true)[0]).toBe('Bonne lecture !')
  })

  it('ignores the hand before the resources are unlocked', () => {
    expect(bubbleCopy('wave', 'play', 'moving', false)).toEqual(invitationCopy.wave)
    expect(bubbleCopy('idle', 'explore', 'hidden', false)).toEqual(invitationCopy.searching)
  })
})
