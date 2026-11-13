import { Eye, Pause, Play, RotateCcw, Square, X } from 'lucide-react'
import { useRef, useState } from 'react'

import {
  Avatar,
  type AvatarController,
  type AvatarRuntimeError,
} from '../../../../packages/avatar-react/src/legacy'
import type { AnimationKey, AvatarDefinition, ExpressionKey } from '@bible-strong/avatar-core'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStudioLanguage } from '@/i18n'

type PlaybackStatus = 'playing' | 'paused' | 'stopped'
type PreviewTarget =
  { type: 'animation'; key: AnimationKey } | { type: 'expression'; key: ExpressionKey }

function RuntimePreviewContent({
  definition: inputDefinition,
  initialAnimation,
}: {
  definition: AvatarDefinition
  initialAnimation?: AnimationKey
}) {
  const { t } = useStudioLanguage()
  const [definition] = useState(inputDefinition)
  const controller = useRef<AvatarController>(null)
  const firstAnimation = initialAnimation ?? definition.animationOrder[0]
  const [target, setTarget] = useState<PreviewTarget>(
    firstAnimation
      ? { type: 'animation', key: firstAnimation }
      : { type: 'expression', key: 'neutral' }
  )
  const [activeAnimation, setActiveAnimation] = useState<AnimationKey | undefined>(firstAnimation)
  const [activeExpression, setActiveExpression] = useState<ExpressionKey>(
    firstAnimation
      ? (definition.animations[firstAnimation]?.steps[0]?.expression ?? 'neutral')
      : 'neutral'
  )
  const [status, setStatus] = useState<PlaybackStatus>(firstAnimation ? 'playing' : 'stopped')
  const [error, setError] = useState<AvatarRuntimeError | null>(null)

  const reportResult = (result: ReturnType<AvatarController['play']>) => {
    if (result.ok) setError(null)
    else setError(result.error)
    return result.ok
  }
  const playAnimation = (animation: AnimationKey) => {
    if (!controller.current || !reportResult(controller.current.play(animation))) return
    setTarget({ type: 'animation', key: animation })
    setActiveAnimation(animation)
    setStatus('playing')
  }
  const showExpression = (expression: ExpressionKey) => {
    if (!controller.current || !reportResult(controller.current.setExpression(expression))) return
    setTarget({ type: 'expression', key: expression })
    setActiveAnimation(undefined)
    setActiveExpression(expression)
    setStatus('stopped')
  }
  const restart = () => {
    if (target.type === 'animation') playAnimation(target.key)
    else showExpression(target.key)
  }
  const pause = () => {
    controller.current?.pause()
    if (activeAnimation) setStatus('paused')
  }
  const stop = () => {
    controller.current?.stop()
    setActiveAnimation(undefined)
    setActiveExpression('neutral')
    setStatus('stopped')
  }

  const statusLabel =
    status === 'playing' ? t('En lecture') : status === 'paused' ? t('En pause') : t('Arrêté')

  return (
    <div className="runtime-preview-body">
      <section className="runtime-preview-stage-card">
        <div className="runtime-preview-stage-heading">
          <div>
            <small>{t('Définition exportée')}</small>
            <strong>{definition.name ?? t('Avatar')}</strong>
          </div>
          <span className="runtime-preview-status" data-status={status}>
            <span aria-hidden="true" />
            {statusLabel}
          </span>
        </div>
        <div className="runtime-preview-stage">
          <Avatar
            ref={controller}
            definition={definition}
            defaultAnimation={firstAnimation}
            defaultExpression={firstAnimation ? undefined : 'neutral'}
            size="min(100%, 400px)"
            ariaLabel={t('Aperçu runtime de l’avatar actif')}
            onAnimationEnd={() => {
              setActiveAnimation(undefined)
              setStatus('stopped')
            }}
            onExpressionChange={setActiveExpression}
            onError={setError}
          />
        </div>
        <div className="runtime-preview-current">
          <div>
            <small>{t('Animation active')}</small>
            <strong>{activeAnimation ?? '—'}</strong>
          </div>
          <div>
            <small>{t('Expression active')}</small>
            <strong>{activeExpression}</strong>
          </div>
        </div>
        <div className="runtime-preview-transport" aria-label={t('Contrôles de lecture')}>
          <Button
            type="button"
            variant="outline"
            disabled={!definition.animationOrder.length}
            onClick={() =>
              playAnimation(target.type === 'animation' ? target.key : firstAnimation!)
            }
          >
            <Play />
            {t('Lire')}
          </Button>
          <Button type="button" variant="outline" disabled={!activeAnimation} onClick={pause}>
            <Pause />
            {t('Pause')}
          </Button>
          <Button type="button" variant="outline" onClick={stop}>
            <Square />
            {t('Arrêter')}
          </Button>
          <Button type="button" variant="outline" onClick={restart}>
            <RotateCcw />
            {t('Relancer')}
          </Button>
        </div>
        {error && (
          <p className="runtime-preview-error" role="alert">
            {error.message}
          </p>
        )}
      </section>

      <aside className="runtime-preview-controls">
        <section>
          <div className="runtime-preview-control-heading">
            <div>
              <small>{definition.animationOrder.length}</small>
              <h3>{t('Animations exportées')}</h3>
            </div>
            <span>{t('Clique pour lancer')}</span>
          </div>
          {definition.animationOrder.length ? (
            <div className="runtime-preview-option-grid">
              {definition.animationOrder.map(animation => (
                <Button
                  type="button"
                  variant="outline"
                  key={animation}
                  aria-pressed={target.type === 'animation' && target.key === animation}
                  onClick={() => playAnimation(animation)}
                >
                  <Play />
                  <span>{definition.animations[animation]?.metadata?.label ?? animation}</span>
                </Button>
              ))}
            </div>
          ) : (
            <p className="runtime-preview-empty">{t('Aucune animation exportée')}</p>
          )}
        </section>

        <section>
          <div className="runtime-preview-control-heading">
            <div>
              <small>{definition.expressionOrder.length}</small>
              <h3>{t('Expressions exportées')}</h3>
            </div>
            <span>{t('Clique pour afficher')}</span>
          </div>
          <div className="runtime-preview-option-grid runtime-preview-expression-grid">
            {definition.expressionOrder.map(expression => (
              <Button
                type="button"
                variant="outline"
                key={expression}
                aria-pressed={target.type === 'expression' && target.key === expression}
                onClick={() => showExpression(expression)}
              >
                <Eye />
                <span>{expression}</span>
              </Button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

export function RuntimePreviewDialog({
  definition,
  initialAnimation,
  onOpenChange,
  open,
}: {
  definition: AvatarDefinition | null
  initialAnimation?: AnimationKey
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useStudioLanguage()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="runtime-preview-dialog">
        <DialogHeader>
          <div className="avatar-guide-kicker">
            <Eye />
            <span>{t('Preview')}</span>
          </div>
          <DialogTitle>{t('Preview de la définition exportée')}</DialogTitle>
          <DialogDescription>
            {t(
              'Teste les animations et expressions réellement présentes dans le fichier .avatar.json.'
            )}
          </DialogDescription>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                className="runtime-preview-close"
                aria-label={t('Fermer la preview')}
              >
                <X />
              </Button>
            }
          />
        </DialogHeader>
        {open && definition && (
          <RuntimePreviewContent definition={definition} initialAnimation={initialAnimation} />
        )}
      </DialogContent>
    </Dialog>
  )
}
