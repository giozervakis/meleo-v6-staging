import fs from 'node:fs'

const file =
  'server/config.js'

let source =
  fs.readFileSync(
    file,
    'utf8'
  )
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')


if (
  !source.includes(
    'stripeReconcileIntervalSeconds'
  )
) {

  const before =
`    portalEnabled: bool(process.env.STRIPE_PORTAL_ENABLED, true)
  },`

  const after =
`    portalEnabled: bool(process.env.STRIPE_PORTAL_ENABLED, true),
    reconcileIntervalSeconds: Math.max(
      300,
      Number(
        process.env.STRIPE_RECONCILE_INTERVAL_SECONDS ||
        3600
      )
    ),
    reconcileLimit: Math.max(
      1,
      Math.min(
        5000,
        Number(
          process.env.STRIPE_RECONCILE_LIMIT ||
          500
        )
      )
    )
  },`

  if (!source.includes(before)) {
    console.error(
      '[FAIL] Stripe config anchor missing'
    )

    process.exit(1)
  }

  source =
    source.replace(
      before,
      after
    )
}


/*
 * Worker currently reads env directly for compatibility,
 * but canonical config lives here.
 */

source =
  source
    .split('\n')
    .map(
      line =>
        line.replace(
          /[ \t]+$/,
          ''
        )
    )
    .join('\n')
    .replace(/\n*$/, '') +
  '\n'


fs.writeFileSync(
  file,
  source,
  'utf8'
)


console.log(
  '[PASS] Stripe reconciliation config installed'
)
