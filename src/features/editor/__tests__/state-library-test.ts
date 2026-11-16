import { clips, states } from '@bible-strong/avatar-core'

import {
  checkStateDocument,
  createState,
  duplicateState,
  freeStateName,
  moveInList,
  parseCustomStates,
  ruleOf,
  setStateRule,
  stateFileText,
  stateNameProblem,
  takeNewClips,
} from '@/features/editor/stateLibrary'
import { runSeconds, stateRun, stateSheet } from '@/features/editor/stateRun'

const none = { clips: [] as string[], states: [] as string[] }
const library = { clips: {}, states: {} }

describe('custom states', () => {
  it('keeps the catalogue names and aliases for the catalogue', () => {
    expect(stateNameProblem('idle', [])).toBe('catalogue')
    expect(stateNameProblem('dots', [])).toBe('catalogue')
    expect(freeStateName('idle', [])).toBe('idle-2')
    expect(stateNameProblem('cheering', [createState('cheering')], 'cheering')).toBeNull()
    expect(stateNameProblem('cheering', [createState('cheering')])).toBe('taken')
  })

  it('switches rules, keeping what the new rule can keep', () => {
    const shuffled = createState('cheer')
    expect(ruleOf(shuffled)).toBe('shuffled')
    const timed = setStateRule(shuffled, 'timed')
    expect(timed).toMatchObject({ next: 'idle', holdSeconds: 3 })
    expect(ruleOf(timed)).toBe('timed')
    const sequence = setStateRule({ ...timed, next: 'happy' }, 'sequence')
    expect(sequence.next).toBe('happy')
    expect(sequence.holdSeconds).toBeUndefined()
    expect(setStateRule(sequence, 'shuffled').next).toBeUndefined()
  })

  it('copies a catalogue state without touching it', () => {
    const copy = duplicateState(states.finished, 'finished-copy')
    copy.clips.push('Idle_A')
    expect(states.finished.clips).toEqual(['Done_B', 'Done_A'])
  })

  it('moves an entry of a list', () => {
    expect(moveInList(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveInList(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
})

describe('reading a state', () => {
  it('reads every state of the catalogue', () => {
    for (const [name, state] of Object.entries(states)) {
      const checked = checkStateDocument({ name: `${name}-x`, ...state }, none)
      expect(checked.problem, name).toBeUndefined()
    }
  })

  it('says where a state goes wrong', () => {
    const problem = (value: unknown) => checkStateDocument(value, none).problem
    expect(problem({ name: 'a', clips: [] })).toEqual({
      path: 'clips',
      message: 'expected a non-empty list of clip names',
    })
    expect(problem({ name: 'a', clips: ['Done_A', 'Nope'] })?.path).toBe('clips[1]')
    expect(problem({ name: 'a', clips: ['Done_A'], face: ' ' })?.path).toBe('face')
    // A drawn face is named as freely as a clip: one the Studio does not have shows neutral.
    expect(problem({ name: 'a', clips: ['Done_A'], face: 'grumpy' })).toBeUndefined()
    expect(problem({ name: 'a', clips: ['Done_A'], morph: 'dots' })?.path).toBe('morph')
    expect(problem({ name: 'a', clips: ['Done_A'], next: 'nowhere' })?.path).toBe('next')
    expect(problem({ name: 'a', clips: ['Done_A'], holdSeconds: 2 })?.message).toBe(
      'only with next'
    )
    expect(
      problem({
        name: 'a',
        clips: ['Hop'],
        newClips: [{ name: 'Hop', duration: 1, tracks: { lids: [{ t: 0, v: [2, 3] }] } }],
      })
    ).toEqual({ path: 'newClips[0].tracks.lids[0].v', message: 'expected 1 number' })
  })

  it('takes the clips a state brings, renaming one whose name another clip has', () => {
    const hop = { ...clips.Done_A, name: 'Hop' }
    const other = { ...clips.Done_B, name: 'Hop' }
    const checked = checkStateDocument(
      { name: 'hopping', clips: ['Hop', 'Idle_B'], newClips: [hop] },
      none
    )
    const taken = takeNewClips(checked.document!, [other])
    expect(taken.clips.map(clip => clip.name)).toEqual(['Hop', 'Hop 2'])
    expect(taken.state.clips).toEqual(['Hop 2', 'Idle_B'])
    // The same clip already kept is not doubled.
    expect(takeNewClips(checked.document!, checked.document!.newClips).clips).toHaveLength(1)
  })

  it('writes a state with the custom clips it plays, and reads it back', () => {
    const hop = { ...clips.Done_A, name: 'Hop' }
    const text = stateFileText({ name: 'hopping', clips: ['Hop', 'Idle_B'] }, [hop])
    const read = checkStateDocument(JSON.parse(text), none)
    expect(read.document?.newClips.map(clip => clip.name)).toEqual(['Hop'])
    expect(parseCustomStates([{ name: 'x', clips: ['Hop'] }], ['Hop'])).toHaveLength(1)
    expect(parseCustomStates([{ name: 'x', clips: ['Hop'] }], [])).toHaveLength(0)
  })
})

describe('the run of a state', () => {
  it('plays a sequence once, in order, then hands over', () => {
    const run = stateRun(library, 'finished')
    const plays = run.filter(segment => !segment.joining)
    expect(plays.slice(0, 2).map(segment => segment.clip)).toEqual(['Done_B', 'Done_A'])
    // Between two clips, the body is led to the next one's rest pose.
    expect(run.some(segment => segment.joining && segment.clip === 'Done_A')).toBe(true)
    expect(run[0].face).toBe('happy')
    expect(run.find(segment => segment.state === 'idle')?.from).toBeCloseTo(
      clips.Done_B.duration + clips.Done_A.duration,
      0
    )
  })

  it('hands a timed state over when its time is up, and not when hand-over is off', () => {
    const run = stateRun(library, 'waking')
    expect(run.find(segment => segment.state === 'idle')?.from).toBeCloseTo(1.6, 1)
    expect(stateRun(library, 'waking', { handover: false }).every(s => s.state === 'waking')).toBe(
      true
    )
  })

  it('plays a custom state that draws a custom clip, and shows its spinner', () => {
    const own = {
      clips: { Hop: { ...clips.Done_A, name: 'Hop' } },
      states: { hopping: { clips: ['Hop'], morph: 'thinking' } },
    }
    const run = stateRun(own, 'hopping', { seconds: 5 })
    expect(run[0]).toMatchObject({ state: 'hopping', clip: 'Hop', morph: 'thinking' })
    expect(runSeconds(own, 'hopping')).toBeGreaterThanOrEqual(12)
    const sheet = stateSheet(own, 'hopping', 4, { seconds: 2 })
    expect(sheet).toHaveLength(9)
    expect(sheet.at(-1)!.frame.spinner).not.toBeNull()
  })
})
