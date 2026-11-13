/**
 * Talk Mode and Stream Mode are tools for the development server only. Their direction comes
 * from Jev through `/api/direct-dialogue`, which only `pnpm dev` serves. A production build
 * leaves out their buttons, their panels and their code.
 */
export const liveModesAvailable = import.meta.env.DEV
