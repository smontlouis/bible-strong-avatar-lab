import { Copy, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'
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
import type { StudioController } from '@/features/studio/useStudioController'

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
    avatarImportRef,
    createNewAvatar,
    draggedAvatarId,
    draggingAvatarId,
    duplicateAvatar,
    expressions,
    prepareStudioProjectImport,
    previewAvatarMove,
    projectImportError,
    reduceMotion,
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
                      <ExpressionPreview
                        expression={expressions[0] ?? defaultExpression}
                        surface={avatar.body.primary}
                        bodyNodes={avatar.body.nodes}
                        colors={avatar.colors}
                        avatarEyes={avatar.eyes ?? defaultAvatarEyes}
                        renderStyle={avatar.renderStyle}
                        id={`avatar-${avatar.id}`}
                      />
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
          <Menu>
            <MenuTrigger
              render={
                <Button
                  variant="outline"
                  className="avatar-add creation-card"
                  aria-label={t('Ajouter un avatar')}
                >
                  <Plus />
                </Button>
              }
            />
            <MenuContent>
              <MenuItem onClick={createNewAvatar}>
                <Plus /> {t('Nouvel avatar')}
              </MenuItem>
              <MenuItem onClick={() => avatarImportRef.current?.click()}>
                <Upload /> {t('Importer un .avatar.json')}
              </MenuItem>
            </MenuContent>
          </Menu>
          <input
            ref={avatarImportRef}
            className="project-import-input"
            type="file"
            accept="application/json,.json,.avatar.json"
            aria-label={t('Importer un .avatar.json')}
            onChange={event => {
              prepareStudioProjectImport(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
          />
        </div>
        {projectImportError && (
          <p className="project-transfer-error" role="alert">
            {projectImportError}
          </p>
        )}
      </section>
    </div>
  )
}
