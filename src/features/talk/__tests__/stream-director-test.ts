import { shouldCompleteStreamBeat, tokenizeSimulatedStream } from '@/features/talk/streamDirector'

describe('simulated talk stream', () => {
  it('preserves whitespace while emitting token-sized chunks', () => {
    expect(tokenizeSimulatedStream('Hello,   world! Next')).toEqual([
      'Hello,   ',
      'world! ',
      'Next',
    ])
  })

  it('closes beats on strong punctuation, useful commas, or a word limit', () => {
    expect(shouldCompleteStreamBeat('This is ready.')).toBe(true)
    expect(shouldCompleteStreamBeat('One two three four,')).toBe(true)
    expect(shouldCompleteStreamBeat('One two three,')).toBe(false)
    expect(shouldCompleteStreamBeat('one two three four five six seven eight')).toBe(true)
  })
})
