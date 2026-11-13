export type ManipulationSession<Value> = {
  initial: Value
  latest: Value
}

export const beginManipulation = <Value>(initial: Value): ManipulationSession<Value> => ({
  initial,
  latest: initial,
})

export const beginManipulationFromRenderedValue = <Value>(
  readRenderedValue: () => Value
): ManipulationSession<Value> => beginManipulation(readRenderedValue())

export const previewManipulation = <Value>(
  session: ManipulationSession<Value>,
  next: Value,
  preview?: (value: Value) => void
) => {
  session.latest = next
  preview?.(next)
}

export const finishManipulation = <Value>(
  session: ManipulationSession<Value>,
  outcome: 'commit' | 'cancel',
  handlers: { preview: (value: Value) => void; commit: (value: Value) => void }
) => {
  if (outcome === 'cancel') {
    handlers.preview(session.initial)
    return session.initial
  }
  handlers.commit(session.latest)
  return session.latest
}
