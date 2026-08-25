import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { defaultAvatarEyes } from '@/features/avatar/avatars'
import { ExpressionPreview } from '@/features/avatar/components/ExpressionWorkspace'
import { defaultExpression } from '@/features/avatar/presets'
import {
  avatarBodyOutlineWidth,
  useAvatarBodyColorOverride,
} from '@/features/rendering/avatarAppearance'
import { LivePixelAvatarCanvas } from '@/features/rendering/components/PixelAvatarCanvas'
import type { RenderedColors, RenderedScene } from '@/features/rendering/renderedScene'
import type { StudioController } from '@/features/studio/useStudioController'

function LiveAvatarPreview({
  avatar,
  colors,
  scene,
  expressionBodyColor,
}: {
  avatar: StudioController['activeAvatar']
  colors: RenderedColors
  scene: RenderedScene
  expressionBodyColor?: string
}) {
  const outlineWidth = avatarBodyOutlineWidth()
  const filled = avatar.renderStyle.type === 'vector' && avatar.renderStyle.filled === true
  const fixedSkinColors =
    avatar.behavior?.expressions.every(
      expression => !expression.bodyColor && !expression.eyeColor
    ) ?? false
  const bodyColorIsOverridden = useAvatarBodyColorOverride(colors.body, avatar.colors.body)
  const bodyColor = fixedSkinColors && !bodyColorIsOverridden ? avatar.colors.body : colors.body
  const eyeColor = fixedSkinColors ? avatar.colors.eyes : colors.eyes
  const inheritBodyColor = Boolean(expressionBodyColor) || bodyColorIsOverridden
  const nodeColor = (id: string | null | undefined) =>
    inheritBodyColor
      ? bodyColor
      : (avatar.body.nodes.find(node => node.id === id)?.color ?? bodyColor)
  const bodyFill = filled ? bodyColor : '#ffffff'
  const clipId = `live-avatar-${avatar.id}`

  if (avatar.renderStyle.type === 'pixel') {
    return (
      <LivePixelAvatarCanvas
        className="avatar-preview avatar-preview-live"
        scene={scene}
        colors={colors}
        style={avatar.renderStyle}
      />
    )
  }

  return (
    <svg
      className="avatar-preview avatar-preview-live"
      viewBox="-150 -150 300 300"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <motion.path d={scene.headPath} />
        </clipPath>
      </defs>
      <motion.g style={{ x: scene.offsetX, y: scene.offsetY }}>
        {scene.backPaths.map((pathValue, index) => {
          const color = nodeColor(scene.backNodeIds.current[index])
          return (
            <motion.path
              className="preview-head"
              d={pathValue}
              key={`back-${index}`}
              style={{ fill: filled ? color : bodyFill, stroke: color, strokeWidth: outlineWidth }}
            />
          )
        })}
        <motion.path
          className="preview-head"
          d={scene.headPath}
          style={{
            fill: bodyFill,
            stroke: bodyColor,
            strokeWidth: outlineWidth,
          }}
        />
        <g clipPath={`url(#${clipId})`}>
          <motion.path
            className="preview-eye"
            d={scene.leftPath}
            opacity={scene.leftOpacity}
            style={{ fill: eyeColor }}
          />
          <motion.path
            className="preview-eye"
            d={scene.rightPath}
            opacity={scene.rightOpacity}
            style={{ fill: eyeColor }}
          />
        </g>
        {scene.frontPaths.map((pathValue, index) => {
          const color = nodeColor(scene.frontNodeIds.current[index])
          return (
            <motion.path
              className="preview-head"
              d={pathValue}
              key={`front-${index}`}
              style={{ fill: filled ? color : bodyFill, stroke: color, strokeWidth: outlineWidth }}
            />
          )
        })}
      </motion.g>
    </svg>
  )
}

export function AvatarPage({ controller }: { controller: StudioController }) {
  const {
    activateAvatar,
    activeAvatarId,
    avatarDragOrigin,
    avatarDragPreview,
    avatars,
    avatarsRef,
    cancelAvatarMove,
    commitAvatarMove,
    createNewAvatar,
    draggedAvatarId,
    draggingAvatarId,
    duplicateAvatar,
    expressions,
    playbackStatus,
    previewAvatarMove,
    reduceMotion,
    renderedColors,
    renderedExpressionBodyColor,
    renderedScene,
    setDeleteAvatarOpen,
    setDraggingAvatarId,
    setFocusAvatarName,
    t,
  } = controller

  return (
    <div className="panel-stack avatar-page">
      <section className="avatar-shelf" aria-label={t('Choisir un avatar')}>
        <div className="avatar-shelf-heading">
          <strong>{t('Double-clic pour modifier')}</strong>
          <span>{avatars.length}</span>
        </div>
        <div className="avatar-grid">
          {avatars.map(avatar => (
            <motion.div
              className="avatar-sort-item"
              data-dragging={draggingAvatarId === avatar.id || undefined}
              key={avatar.id}
              layout="position"
              animate={{
                opacity: draggingAvatarId === avatar.id ? 0.28 : 1,
                scale: draggingAvatarId === avatar.id ? 0.96 : 1,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
              }
            >
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <Button
                      className="avatar-card"
                      variant="outline"
                      aria-pressed={activeAvatarId === avatar.id}
                      type="button"
                      draggable
                      onDragStart={event => {
                        avatarDragOrigin.current = avatarsRef.current
                        avatarDragPreview.current = avatarsRef.current
                        draggedAvatarId.current = avatar.id
                        setDraggingAvatarId(avatar.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnter={() => previewAvatarMove(avatar.id)}
                      onDragOver={event => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={event => {
                        event.preventDefault()
                        commitAvatarMove(avatar.id)
                      }}
                      onDragEnd={cancelAvatarMove}
                      onClick={() => activateAvatar(avatar.id, false, true)}
                      onDoubleClick={() => {
                        setFocusAvatarName(false)
                        activateAvatar(avatar.id, true)
                      }}
                    >
                      {activeAvatarId === avatar.id && playbackStatus !== 'stopped' ? (
                        <LiveAvatarPreview
                          avatar={avatar}
                          colors={renderedColors}
                          scene={renderedScene}
                          expressionBodyColor={renderedExpressionBodyColor}
                        />
                      ) : (
                        <ExpressionPreview
                          expression={expressions[0] ?? defaultExpression}
                          surface={avatar.body.primary}
                          bodyNodes={avatar.body.nodes}
                          colors={avatar.colors}
                          avatarEyes={avatar.eyes ?? defaultAvatarEyes}
                          renderStyle={avatar.renderStyle}
                          id={`avatar-${avatar.id}`}
                        />
                      )}
                      <span>{avatar.name}</span>
                    </Button>
                  }
                />
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => {
                      setFocusAvatarName(false)
                      activateAvatar(avatar.id, true)
                    }}
                  >
                    <Pencil /> {t('Modifier')}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => duplicateAvatar(avatar)}>
                    <Copy /> {t('Dupliquer')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    disabled={avatars.length <= 1}
                    onClick={() => {
                      activateAvatar(avatar.id, false, true)
                      setDeleteAvatarOpen(true)
                    }}
                  >
                    <Trash2 /> {t('Supprimer')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </motion.div>
          ))}
          <Button
            variant="outline"
            className="avatar-add creation-card"
            onClick={createNewAvatar}
            aria-label={t('Nouvel avatar')}
          >
            <Plus />
          </Button>
        </div>
      </section>
    </div>
  )
}
