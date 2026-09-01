import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const packageInfo = require('../package.json')

export const APP_VERSION = packageInfo.version

export const RELEASE_CHANNEL =
  APP_VERSION.includes('-rc.')
    ? 'release-candidate'
    : 'production'

export const RELEASE_NAME =
  `MELEO v${APP_VERSION}`
