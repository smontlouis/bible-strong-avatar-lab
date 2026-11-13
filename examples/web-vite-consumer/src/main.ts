import { createAvatar } from '@bible-strong/avatar-web'

// A file of the first format: only its character is kept.
import character from '../../react-vite-consumer/src/strobi.avatar.json'
import './styles.css'

const status = document.querySelector<HTMLOutputElement>('#status')!

const avatar = createAvatar('#avatar', {
  character,
  state: 'sleeping',
  size: '100%',
  followPointer: true,
  onStateChange: state => {
    status.value = state ?? 'clip'
  },
})
status.value = avatar.getState().state ?? 'clip'

document.querySelectorAll<HTMLButtonElement>('[data-state]').forEach(button => {
  button.addEventListener('click', () => avatar.setState(button.dataset.state ?? 'idle'))
})
document.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(button => {
  button.addEventListener('click', () => avatar.poke(button.dataset.gesture as 'nod'))
})
let muted = false
document.querySelector('#mute')?.addEventListener('click', () => {
  muted = !muted
  avatar.setMuted(muted)
})
let paused = false
document.querySelector('#pause')?.addEventListener('click', () => {
  paused = !paused
  if (paused) avatar.pause()
  else avatar.resume()
})
