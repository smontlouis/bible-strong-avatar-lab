import {
  validateAvatarDefinition,
  type AnimationKey,
  type AvatarDefinition,
  type ExpressionKey,
} from '@bible-strong/avatar-core'
import type { ReactElement } from 'react'

import {
  Avatar,
  markAvatarDefinitionValidated,
  type AvatarController,
  type AvatarProps,
} from './LegacyAvatar'

type AvatarDefinitionInput = {
  expressions: object
  animations: object
}

type StringKey<T> = Extract<keyof T, string>

/** Props for a component created from one concrete avatar definition. */
export type CreatedAvatarProps<Definition extends AvatarDefinitionInput> = Omit<
  AvatarProps,
  'definition' | 'animation' | 'expression' | 'defaultAnimation' | 'defaultExpression'
> & {
  animation?: StringKey<Definition['animations']>
  defaultAnimation?: StringKey<Definition['animations']>
  expression?: StringKey<Definition['expressions']>
  defaultExpression?: StringKey<Definition['expressions']>
}

/** A concrete avatar component with animation and expression keys from its definition. */
export type CreatedAvatarComponent<Definition extends AvatarDefinitionInput> = (
  props: CreatedAvatarProps<Definition>
) => ReactElement

const invalidDefinitionError = (errors: readonly { path: string; message: string }[]) => {
  const first = errors[0]
  return new Error(
    first
      ? `Invalid avatar definition${first.path ? ` at ${first.path}` : ''}: ${first.message}`
      : 'Invalid avatar definition.'
  )
}

const buildAvatarComponent = (definition: Readonly<AvatarDefinition>) => {
  const ConcreteAvatar = (props: CreatedAvatarProps<AvatarDefinition>): ReactElement => (
    <Avatar {...props} definition={definition} />
  )
  ConcreteAvatar.displayName = 'CreatedAvatar'
  return ConcreteAvatar
}

/**
 * Validate a JSON-compatible definition once and create a concrete React component from it.
 *
 * When the input is a statically typed definition, the returned component narrows its animation
 * and expression props to that definition's semantic keys. Values loaded at runtime are still
 * validated, but necessarily expose the broad string-key API at compile time.
 */
export function createAvatar<const Definition extends AvatarDefinitionInput>(
  definition: Definition
): CreatedAvatarComponent<Definition>
export function createAvatar(definition: unknown): CreatedAvatarComponent<AvatarDefinition>
export function createAvatar(definition: unknown): CreatedAvatarComponent<AvatarDefinition> {
  const result = validateAvatarDefinition(definition)
  if (!result.ok) throw invalidDefinitionError(result.errors)
  markAvatarDefinitionValidated(result.value)
  return buildAvatarComponent(result.value)
}

export type { AnimationKey, AvatarController, ExpressionKey }
