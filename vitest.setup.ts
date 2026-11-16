// jsdom has no pointer capture. The Studio calls it on every drag; a test of a drag gets the
// methods a browser has, doing nothing, rather than an error thrown outside the test.
if (typeof Element !== 'undefined' && !('setPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  })
}

// jsdom has no 2D canvas. Paper.js, which the face editor reads paths with, asks for one when it
// loads, to learn what the browser draws: a context that does nothing lets it load. Nothing in
// the tests draws on a canvas.
if (typeof HTMLCanvasElement !== 'undefined') {
  const nothing = () => {}
  const context = new Proxy(
    { globalCompositeOperation: 'source-over' } as Record<string, unknown>,
    {
      get: (target, key) => (typeof key === 'string' && key in target ? target[key] : nothing),
      set: (target, key, value) => {
        if (typeof key === 'string') target[key] = value
        return true
      },
    }
  )
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as HTMLCanvasElement['getContext']
}
