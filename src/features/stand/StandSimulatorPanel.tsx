import { Keyboard } from 'lucide-react'
import { useStudioLanguage } from '@/i18n'
import type { createStandSimulator } from './standSimulator'

type SimulatorState = ReturnType<typeof createStandSimulator>['state']

/** Keyboard legend for `/stand?simulate`; the synthetic visitor feeds the real director. */
export function StandSimulatorPanel({ state }: { state: SimulatorState | null }) {
  const { t } = useStudioLanguage()
  const rows: [string, string, boolean | undefined][] = [
    ['Espace', t('Visiteur'), state?.present],
    ['↑ ↓', `${t('Distance')} · ${state ? state.distance.toFixed(1) : '—'} m`, undefined],
    ['← →', t('Se déplacer'), undefined],
    ['W', t('Coucou'), undefined],
    ['S', t('Sourire'), state?.smile],
    ['T', t('Pouce levé'), state?.thumb],
    ['V', t('Victoire'), state?.victory],
    ['B', t('Pouce baissé'), state?.thumbDown],
    ['P', t('Tête penchée'), state?.tilt],
    ['M', t('Main (clic = poing)'), state?.handRaised],
    ['A / R', `${t('Autres visiteurs')} · ${state?.extras ?? 0}`, undefined],
  ]
  return (
    <aside className="stand-simulator" aria-label={t('Simulation clavier')}>
      <p>
        <Keyboard aria-hidden="true" />
        {t('Simulation clavier')}
      </p>
      <dl>
        {rows.map(([key, label, active]) => (
          <div key={key} data-active={active}>
            <dt>
              <kbd>{key}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
