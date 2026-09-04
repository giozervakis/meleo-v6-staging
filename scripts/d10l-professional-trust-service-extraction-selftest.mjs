import fs from 'node:fs'
import cp from 'node:child_process'

const APP =
  'server/relational/app.js'

const SERVICE =
  'server/services/professional-trust.service.js'

const BASE =
  '9f88757'

const app =
  fs.readFileSync(
    APP,
    'utf8'
  )

const service =
  fs.readFileSync(
    SERVICE,
    'utf8'
  )

const pristine =
  cp.execFileSync(
    'git',
    [
      'show',
      `${BASE}:${APP}`
    ],
    {
      encoding:'utf8'
    }
  )

function pass(label) {
  console.log(
    `[PASS] ${label}`
  )
}

function need(condition, label) {
  if (!condition) {
    console.error(
      `[FAIL] ${label}`
    )

    process.exit(1)
  }

  pass(label)
}

function countOf(text, needle) {
  return text.split(needle).length - 1
}

function extractFunction(
  text,
  marker
) {
  const start =
    text.indexOf(marker)

  if (start < 0) {
    throw new Error(
      `marker missing: ${marker}`
    )
  }

  const open =
    text.indexOf(
      '{',
      start + marker.length
    )

  let depth = 0
  let state = 'code'

  for (
    let i = open;
    i < text.length;
    i++
  ) {
    const ch = text[i]
    const next = text[i + 1]

    if (state === 'single') {
      if (ch === '\\') i++
      else if (ch === "'") state = 'code'
      continue
    }

    if (state === 'double') {
      if (ch === '\\') i++
      else if (ch === '"') state = 'code'
      continue
    }

    if (state === 'template') {
      if (ch === '\\') i++
      else if (ch === '`') state = 'code'
      continue
    }

    if (state === 'line-comment') {
      if (ch === '\n') state = 'code'
      continue
    }

    if (state === 'block-comment') {
      if (
        ch === '*' &&
        next === '/'
      ) {
        state = 'code'
        i++
      }

      continue
    }

    if (
      ch === '/' &&
      next === '/'
    ) {
      state = 'line-comment'
      i++
      continue
    }

    if (
      ch === '/' &&
      next === '*'
    ) {
      state = 'block-comment'
      i++
      continue
    }

    if (ch === "'") {
      state = 'single'
      continue
    }

    if (ch === '"') {
      state = 'double'
      continue
    }

    if (ch === '`') {
      state = 'template'
      continue
    }

    if (ch === '{') {
      depth++
      continue
    }

    if (ch === '}') {
      depth--

      if (depth === 0) {
        return text.slice(
          start,
          i + 1
        )
      }
    }
  }

  throw new Error(
    'function closing brace missing'
  )
}

const marker =
  'async function meleoTrustForProfessional(professionalId)'

need(
  app.includes(
    "import { createProfessionalTrustService } from '../services/professional-trust.service.js'"
  ),
  'app imports professional trust service'
)

need(
  app.includes(
    'createProfessionalTrustService({'
  ),
  'app composes professional trust service'
)

need(
  !app.includes(marker),
  'app no longer owns trust helper'
)

need(
  service.includes(marker),
  'service owns trust helper'
)

need(
  /createProfessionalTrustService\(\{\s*one\s*\}\)/s.test(
    service
  ),
  'trust service has minimal one-only DI'
)

/*
 * The function moved into the service must be semantically
 * identical to the function from the clean base commit.
 */
const originalFunction =
  extractFunction(
    pristine,
    marker
  )

const serviceFunction =
  extractFunction(
    service,
    marker
  )

const normalizeEol =
  value =>
    value.replace(/\r\n/g, '\n')

const removeServiceIndent =
  value =>
    normalizeEol(value)
      .split('\n')
      .map(
        (line,index) =>
          index === 0
            ? line
            : (
                line.startsWith('  ')
                  ? line.slice(2)
                  : line
              )
      )
      .join('\n')

need(
  removeServiceIndent(serviceFunction) ===
    normalizeEol(originalFunction),
  'trust function moved verbatim from base commit'
)

need(
  serviceFunction.includes(
    'SELECT id,verified,rating,reviews_count "reviewsCount" FROM professionals'
  ),
  'professional trust source query preserved'
)

need(
  serviceFunction.includes(
    'FROM bookings WHERE professional_id=$1'
  ),
  'booking trust statistics query preserved'
)

need(
  serviceFunction.includes(
    "status='completed'"
  ),
  'completed booking semantics preserved'
)

need(
  serviceFunction.includes(
    "status='cancelled'"
  ),
  'cancelled booking semantics preserved'
)

need(
  serviceFunction.includes(
    "interval '90 days'"
  ),
  'recent activity window preserved'
)

need(
  serviceFunction.includes(
    'completionRate'
  ),
  'completion-rate calculation preserved'
)

need(
  serviceFunction.includes(
    'responseRate'
  ),
  'response-rate calculation preserved'
)

need(
  serviceFunction.includes(
    'cancellationReliability'
  ),
  'cancellation reliability preserved'
)

need(
  serviceFunction.includes(
    'eligible='
  ),
  'trust eligibility calculation preserved'
)

need(
  app.indexOf(
    'createProfessionalTrustService({'
  ) <
  app.indexOf(
    'createSmartMatchingService({'
  ),
  'trust service is composed before Smart Matching'
)

need(
  app.includes(
    'createSmartMatchingService({'
  ) &&
  app.includes(
    'meleoTrustForProfessional'
  ),
  'Smart Matching still receives trust function'
)

need(
  /registerProfessionalAnalyticsRoutes\([\s\S]*?meleoTrustForProfessional/s.test(
    app
  ),
  'Professional Analytics still receives trust function'
)

need(
  countOf(
    app,
    'createProfessionalTrustService({'
  ) === 1,
  'trust service composed exactly once'
)

console.log('')
console.log(
  'MELEO D10L.23 professional trust service extraction self-test: OK'
)
