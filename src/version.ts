declare const __MELEO_APP_VERSION__: string
declare const __MELEO_BUILD_SHA__: string

export const APP_VERSION =
  __MELEO_APP_VERSION__

export const APP_VERSION_LABEL =
  `v${APP_VERSION}`

export const BUILD_SHA =
  __MELEO_BUILD_SHA__

export const BUILD_SHA_SHORT =
  BUILD_SHA === 'local'
    ? 'local'
    : BUILD_SHA.slice(0, 7)