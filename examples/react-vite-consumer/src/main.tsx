import { stateGroups } from '@bible-strong/avatar-core'
import { createAvatar } from '@bible-strong/avatar-react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

// A file of the first format: only its character is kept.
import strobi from './strobi.avatar.json'
import './styles.css'

const Strobi = createAvatar(strobi)

function Demo() {
  const [state, setState] = useState('idle')
  const [shown, setShown] = useState<string | null>('idle')

  return (
    <main>
      <h1>Avatar package consumer</h1>
      <section className="avatar-host" aria-label="Embedded avatar example">
        <Strobi
          state={state}
          size={240}
          ariaLabel="Embedded Strobi avatar"
          onStateChange={setShown}
        />
      </section>
      <section className="expression-picker" aria-labelledby="state-picker-title">
        <div className="expression-picker__heading">
          <h2 id="state-picker-title">States</h2>
          <output aria-live="polite">Now: {shown ?? 'clip'}</output>
        </div>
        <div className="expression-picker__list">
          {stateGroups.map(group => (
            <section key={group.label} className="expression-picker__group">
              <h3>{group.label}</h3>
              <div className="expression-picker__group-list">
                {group.states.map(name => (
                  <button
                    key={name}
                    type="button"
                    className={name === state ? 'is-selected' : undefined}
                    aria-pressed={name === state}
                    onClick={() => setState(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="avatar-overlay" aria-label="Positioned avatar example">
        <Strobi state={state} size={128} ariaLabel="Positioned Strobi avatar" />
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
