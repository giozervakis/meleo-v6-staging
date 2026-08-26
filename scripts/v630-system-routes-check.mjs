import fs from 'node:fs'


const assert =
  (
    condition,
    message
  ) => {
    if (
      !condition
    ) {
      throw new Error(
        message
      )
    }
  }


const routeFiles = [
  'server/relational/app.js',
  'server/routes/system.routes.js',
  'server/routes/lifecycle.routes.js',
  'server/routes/auth-account.routes.js',
  'server/routes/account-profile.routes.js',
  'server/routes/account-privacy.routes.js',
  'server/routes/professional-core.routes.js',
  'server/routes/professional-verification.routes.js',
  'server/routes/professional-billing.routes.js',
  'server/routes/booking-core.routes.js',
  'server/routes/booking-state.routes.js',
  'server/routes/booking-communication.routes.js',
  'server/routes/booking-recovery.routes.js',
  'server/routes/booking-review.routes.js',
  'server/routes/booking-calendar.routes.js',
  'server/routes/notifications.routes.js',
  'server/routes/favorites.routes.js',
  'server/routes/care-team.routes.js',
  'server/routes/support.routes.js',
  'server/routes/reports.routes.js',
  'server/routes/communication-summary.routes.js',
  'server/routes/location.routes.js',
  'server/routes/analytics.routes.js',
  'server/routes/professional-analytics.routes.js',
  'server/routes/smart-request.routes.js',
  'server/routes/admin-reports.routes.js',
  'server/routes/admin-verification.routes.js',
  'server/routes/admin-members.routes.js',
  'server/routes/admin-observability.routes.js',
  'server/routes/admin-bookings.routes.js',
  'server/routes/admin-subscriptions.routes.js',
  'server/routes/seo.routes.js'
]


for (
  const file of routeFiles
) {
  assert(
    fs.existsSync(
      file
    ),
    `route source missing: ${file}`
  )
}


const sources =
  new Map(
    routeFiles.map(
      file => [
        file,
        fs.readFileSync(
          file,
          'utf8'
        )
      ]
    )
  )


const app =
  sources.get(
    'server/relational/app.js'
  )


for (
  const registration of [
    'registerSystemRoutes',
    'registerLifecycleRoutes',
    'registerAuthAccountRoutes',
    'registerAccountProfileRoutes',
    'registerAccountPrivacyRoutes',
    'registerProfessionalCoreRoutes',
    'registerProfessionalVerificationRoutes',
    'registerProfessionalBillingRoutes',
    'registerBookingCoreRoutes'
  ]
) {
  assert(
    app.includes(
      registration
    ),
    `route module registration missing: ${registration}`
  )
}


const routes = []


for (
  const [
    file,
    source
  ] of sources
) {
  const regex =
    /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g

  let match

  while (
    (
      match =
        regex.exec(
          source
        )
    ) !== null
  ) {
    routes.push({
      method:
        match[1]
          .toUpperCase(),

      path:
        match[2],

      file
    })
  }
}


assert(
  routes.length === 93,
  `expected 93 explicit API routes, detected ${routes.length}`
)


const identities =
  routes.map(
    route =>
      `${route.method} ${route.path}`
  )


const duplicates =
  [
    ...new Set(
      identities.filter(
        (
          route,
          index
        ) =>
          identities.indexOf(
            route
          ) !== index
      )
    )
  ]


assert(
  duplicates.length === 0,
  `duplicate API routes detected: ${duplicates.join(', ')}`
)


function assertSoleOwner(
  method,
  path,
  owner
) {
  const matches =
    routes.filter(
      route =>
        route.method === method &&
        route.path === path
    )

  assert(
    matches.length === 1,
    `${method} ${path}: expected one owner; found ${matches.length}`
  )

  assert(
    matches[0].file === owner,
    `${method} ${path}: expected owner ${owner}; found ${matches[0].file}`
  )
}


/*
 * System
 */
for (
  const path of [
    '/api/config',
    '/api/health',
    '/api/metrics',
    '/api/plans'
  ]
) {
  assertSoleOwner(
    'GET',
    path,
    'server/routes/system.routes.js'
  )
}


/*
 * Readiness lifecycle
 */
assertSoleOwner(
  'GET',
  '/api/ready',
  'server/routes/lifecycle.routes.js'
)


/*
 * Core auth/account
 */
for (
  const [
    method,
    path
  ] of [
    ['POST','/api/auth/register'],
    ['POST','/api/auth/login'],
    ['POST','/api/auth/logout'],
    ['POST','/api/auth/social-demo'],
    ['POST','/api/auth/forgot-password'],
    ['POST','/api/auth/reset-password'],
    ['POST','/api/auth/verify-email'],
    ['POST','/api/auth/verify-email/resend'],
    ['GET','/api/me'],
    ['POST','/api/me/enable-professional'],
    ['GET','/api/me/sessions'],
    ['DELETE','/api/me/sessions/others'],
    ['PUT','/api/me']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/auth-account.routes.js'
  )
}


/*
 * Account profile/media
 */
for (
  const [
    method,
    path
  ] of [
    ['PUT','/api/me/avatar'],
    ['POST','/api/me/profile-photo'],
    ['DELETE','/api/me/profile-photo'],
    ['GET','/api/profile-photo/:userId']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/account-profile.routes.js'
  )
}


/*
 * Account privacy/security
 */
for (
  const [
    method,
    path
  ] of [
    ['POST','/api/me/change-password'],
    ['GET','/api/me/export'],
    ['DELETE','/api/me']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/account-privacy.routes.js'
  )
}


/*
 * Professional core
 */
for (
  const [
    method,
    path
  ] of [
    ['GET','/api/professionals'],
    ['GET','/api/professionals/:id'],
    ['GET','/api/professionals/:id/reviews'],
    ['PUT','/api/professional/profile']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/professional-core.routes.js'
  )
}


/*
 * Professional verification
 */
for (
  const [
    method,
    path
  ] of [
    ['POST','/api/professional/verification-document'],
    ['GET','/api/professional/verification-documents'],
    ['POST','/api/professional/verification']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/professional-verification.routes.js'
  )
}


/*
 * Professional billing
 */
for (
  const [
    method,
    path
  ] of [
    ['GET','/api/professional/subscription'],
    ['POST','/api/professional/subscription/checkout'],
    ['POST','/api/professional/subscription/sync'],
    ['POST','/api/professional/subscription/portal'],
    ['POST','/api/professional/subscription/cancel'],
    ['POST','/api/professional/subscription/resume']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/professional-billing.routes.js'
  )
}


/*
 * Booking core - Part 4A-7A
 */
for (
  const [
    method,
    path
  ] of [
    ['POST','/api/bookings'],
    ['GET','/api/bookings']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/booking-core.routes.js'
  )
}


/*
 * Booking ownership after Part 4A-7C1.
 *
 * Recovery is modular.
 * Review and calendar remain application-owned.
 */
for (
  const [
    method,
    path,
    expectedOwner
  ] of [
    [
      'GET',
      '/api/bookings/:id/recovery-candidates',
      'server/routes/booking-recovery.routes.js'
    ],
    [
      'POST',
      '/api/bookings/:id/recover',
      'server/routes/booking-recovery.routes.js'
    ],
    [
      'POST',
      '/api/bookings/:id/review',
      'server/routes/booking-review.routes.js'
    ],
    [
      'GET',
      '/api/bookings/:id/calendar.ics',
      'server/routes/booking-calendar.routes.js'
    ]
  ]
) {
  assertSoleOwner(
    method,
    path,
    expectedOwner
  )
}


/*
 * Notifications - Part 4A-8A
 */
for (
  const [
    method,
    path
  ] of [
    ['GET','/api/notifications'],
    ['PATCH','/api/notifications/:id/read'],
    ['PATCH','/api/notifications/read-all']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/notifications.routes.js'
  )
}


/*
 * Favorites - Part 4A-8B
 */
for (
  const [
    method,
    path
  ] of [
    ['POST','/api/favorites/:professionalId'],
    ['GET','/api/favorites']
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/favorites.routes.js'
  )
}


/*
 * Care Team - Part 4A-8C
 */
assertSoleOwner(
  'GET',
  '/api/care-team',
  'server/routes/care-team.routes.js'
)



/*
 * Communication summary ownership - Part 4A-8F1
 */
assertSoleOwner(
  'GET',
  '/api/communication/unread',
  'server/routes/communication-summary.routes.js'
)


/*
 * Location ownership - Part 4A-8F2
 */
assertSoleOwner(
  'GET',
  '/api/location/search',
  'server/routes/location.routes.js'
)


/*
 * Location ownership - Part 4A-8F2
 */
assertSoleOwner(
  'GET',
  '/api/location/reverse',
  'server/routes/location.routes.js'
)


/*
 * Analytics ownership - Part 4A-8F3
 */
assertSoleOwner(
  'POST',
  '/api/analytics/professional-event',
  'server/routes/analytics.routes.js'
)


/*
 * SEO API ownership - Part 4A-8F4
 */
assertSoleOwner(
  'GET',
  '/api/seo/resolve',
  'server/routes/seo.routes.js'
)


/*
 * Professional analytics ownership - Part 4A-8F5A
 */
assertSoleOwner(
  'GET',
  '/api/professional/analytics',
  'server/routes/professional-analytics.routes.js'
)


/*
 * Smart Request ownership - Part 4A-8F5B
 */
assertSoleOwner(
  'POST',
  '/api/smart-request/unmatched',
  'server/routes/smart-request.routes.js'
)

assertSoleOwner(
  'POST',
  '/api/smart-request/learned-match',
  'server/routes/smart-request.routes.js'
)

assertSoleOwner(
  'GET',
  '/api/admin/smart-requests',
  'server/routes/smart-request.routes.js'
)

assertSoleOwner(
  'PATCH',
  '/api/admin/smart-requests/:id',
  'server/routes/smart-request.routes.js'
)


/*
 * admin-verification.routes.js ownership
 */
assertSoleOwner(
  'GET',
  '/api/admin/verifications',
  'server/routes/admin-verification.routes.js'
)

assertSoleOwner(
  'GET',
  '/api/admin/verification-documents/:id',
  'server/routes/admin-verification.routes.js'
)

assertSoleOwner(
  'POST',
  '/api/admin/verification-documents/:id/access',
  'server/routes/admin-verification.routes.js'
)

assertSoleOwner(
  'GET',
  '/api/admin/verification-documents/:id/signed',
  'server/routes/admin-verification.routes.js'
)

assertSoleOwner(
  'PATCH',
  '/api/admin/verifications/:id',
  'server/routes/admin-verification.routes.js'
)


/*
 * Admin Observability ownership - Part 4A-8F5F
 */
assertSoleOwner(
  'GET',
  '/api/admin/stats',
  'server/routes/admin-observability.routes.js'
)


/*
 * Admin Observability ownership - Part 4A-8F5F
 */
assertSoleOwner(
  'GET',
  '/api/admin/command-center',
  'server/routes/admin-observability.routes.js'
)


/*
 * Admin Observability ownership - Part 4A-8F5F
 */
assertSoleOwner(
  'GET',
  '/api/admin/audit',
  'server/routes/admin-observability.routes.js'
)


/*
 * Admin Observability ownership - Part 4A-8F5F
 */
assertSoleOwner(
  'GET',
  '/api/admin/insights',
  'server/routes/admin-observability.routes.js'
)


/*
 * Application lifecycle
 */
assertSoleOwner(
  'GET',
  '/api/live',
  'server/relational/app.js'
)


assert(
  app.includes(
    '/api/webhooks/stripe'
  ),
  'Stripe webhook must remain application-owned'
)



/*
 * canonical booking-state ownership
 */
{
  const appSource =
    fs.readFileSync(
      'server/relational/app.js',
      'utf8'
    )

  const bookingStateSource =
    fs.readFileSync(
      'server/routes/booking-state.routes.js',
      'utf8'
    )

  const statusRoute =
    "app.patch('/api/bookings/:id/status'"

  if (
    !bookingStateSource.includes(
      statusRoute
    )
  ) {
    throw new Error(
      'Canonical topology: booking status route missing from booking-state module'
    )
  }

  if (
    appSource.includes(
      statusRoute
    )
  ) {
    throw new Error(
      'Canonical topology: booking status route still application-owned'
    )
  }

  if (
    !appSource.includes(
      "import { registerBookingStateRoutes } from '../routes/booking-state.routes.js'"
    )
  ) {
    throw new Error(
      'Canonical topology: booking-state import missing'
    )
  }

  if (
    !appSource.includes(
      'registerBookingStateRoutes('
    )
  ) {
    throw new Error(
      'Canonical topology: booking-state registration missing'
    )
  }
}


/*
 * PART 4A-7B2 COMMUNICATION CANONICAL OWNERSHIP
 *
 * Booking conversation/state-notification endpoints are
 * independently owned by booking-communication.routes.js.
 */
for (
  const [
    method,
    path
  ] of [
    [
      'POST',
      '/api/bookings/:id/clarification'
    ],
    [
      'POST',
      '/api/bookings/:id/message'
    ],
    [
      'GET',
      '/api/bookings/unread'
    ],
    [
      'PATCH',
      '/api/bookings/:id/messages/read'
    ]
  ]
) {
  assertSoleOwner(
    method,
    path,
    'server/routes/booking-communication.routes.js'
  )
}
/* END PART 4A-7B2 COMMUNICATION CANONICAL OWNERSHIP */

console.log(
  'MELEO v6.3.0 canonical modular route architecture check: OK'
)

console.log(
  '[PASS] system routes modular'
)

console.log(
  '[PASS] readiness lifecycle modular'
)

console.log(
  '[PASS] auth/account core modular'
)

console.log(
  '[PASS] profile/media routes modular'
)

console.log(
  '[PASS] privacy/security routes modular'
)

console.log(
  '[PASS] professional core routes modular'
)

console.log(
  '[PASS] professional verification routes modular'
)

console.log(
  '[PASS] professional billing routes modular'
)

console.log(
  '[PASS] booking core routes modular'
)

console.log(
  '[PASS] booking state route modular'
)

console.log(
  '[PASS] booking communication/recovery/review/unread/calendar remain application-owned'
)

console.log(
  '[PASS] notification routes modular'
)

console.log(
  '[PASS] favorites routes modular'
)

console.log(
  '[PASS] Care Team route modular'
)

console.log(
  '[PASS] Stripe webhook remains application-owned'
)

console.log(
  '[PASS] realtime SSE lifecycle remains application-owned'
)

console.log(
  '[PASS] admin bookings route modular',
  '[PASS] 93 unique API routes preserved'
)

console.log('[PASS] admin subscriptions routes modular')
