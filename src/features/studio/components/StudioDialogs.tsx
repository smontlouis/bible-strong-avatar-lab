import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'

import type { StudioController } from '@/features/studio/useStudioController'

export function StudioDialogs({ controller }: { controller: StudioController }) {
  const {
    activeAvatar,
    animationsAffectedByExpressionDeletion,
    avatars,
    confirmStudioProjectImport,
    deleteActiveAvatar,
    deleteAvatarOpen,
    deleteEditing,
    deleteExpressionOpen,
    deleteSequenceEditing,
    deleteSequenceOpen,
    expression,
    expressions,
    pendingProjectImport,
    setDeleteAvatarOpen,
    setDeleteExpressionOpen,
    setDeleteSequenceOpen,
    setPendingProjectImport,
    t,
  } = controller
  return (
    <>
      <AlertDialog open={deleteAvatarOpen} onOpenChange={setDeleteAvatarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`Supprimer ${activeAvatar.name} ?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Le corps, les expressions et les animations propres à cet avatar seront définitivement supprimés. La bibliothèque de base sera conservée.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteActiveAvatar}>{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteExpressionOpen} onOpenChange={setDeleteExpressionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Supprimer cette expression ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Cette action retirera définitivement le preset de la bibliothèque de cet avatar.'
              )}
            </AlertDialogDescription>
            {animationsAffectedByExpressionDeletion.length > 0 && (
              <div className="mt-2 grid gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-foreground">
                  {t('Cette expression sera aussi retirée des animations suivantes :')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {animationsAffectedByExpressionDeletion.map(sequence => (
                    <Badge key={sequence.id} variant="outline">
                      {sequence.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Si une animation ne contient que cette expression, l’expression de repli lui sera assignée pour qu’elle reste jouable.'
                  )}
                </p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEditing}>{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteSequenceOpen} onOpenChange={setDeleteSequenceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Supprimer cette animation ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Cette action supprimera définitivement cette animation.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSequenceEditing}>{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingProjectImport !== null}
        onOpenChange={open => {
          if (!open) setPendingProjectImport(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingProjectImport?.kind === 'avatar'
                ? t('Importer cet avatar ?')
                : t('Importer ce projet ?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingProjectImport?.kind === 'avatar'
                ? t(
                    'Cet avatar sera ajouté à ta bibliothèque avec ses expressions et animations, puis sélectionné. Les autres avatars sont conservés.'
                  )
                : t(
                    'Le projet local actuel sera remplacé par les avatars, expressions, animations et état de lecture de ce fichier.'
                  )}{' '}
              {pendingProjectImport?.fileName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStudioProjectImport}>
              {t('Importer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
