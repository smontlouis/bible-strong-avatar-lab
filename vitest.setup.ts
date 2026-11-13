// jsdom has no pointer capture. The Studio calls it on every drag; a test of a drag gets the
// methods a browser has, doing nothing, rather than an error thrown outside the test.
if (typeof Element !== 'undefined' && !('setPointerCapture' in Element.prototype)) {
  Object.assign(Element.prototype, {
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  })
}
