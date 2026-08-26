import fs from 'node:fs'

function assert(
  condition,
  message
) {
  if (!condition) {
    throw new Error(message)
  }
}


const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const report =
  fs.readFileSync(
    'server/routes/reports.routes.js',
    'utf8'
  )


assert(
  app.includes(
    "import { registerReportRoutes } from '../routes/reports.routes.js'"
  ),
  'Report registrar import missing'
)


assert(
  app.includes(
    'registerReportRoutes('
  ),
  'Report registrar invocation missing'
)


assert(
  !app.includes(
    "app.post('/api/reports'"
  ),
  'Public report route remains application-owned'
)


assert(
  report.includes(
    "app.post('/api/reports'"
  ),
  'Public report route missing from module'
)


for (
  const marker of [
    'auth',
    'limits.write',
    "id('rpt')",
    'INSERT INTO reports',
    'reporter_user_id',
    'target_type',
    'target_id',
    'reason',
    'details',
    'str(req.body.targetType,40)',
    'str(req.body.targetId,80)',
    'str(req.body.reason,200)',
    'str(req.body.details,1500)',
    'res.json({ok:true,id:rid})'
  ]
) {
  assert(
    report.includes(marker),
    `Report behavior changed: ${marker}`
  )
}


assert(
  app.includes(
    "app.get('/api/admin/reports'"
  ),
  'Admin reports listing moved prematurely'
)


assert(
  app.includes(
    "app.patch('/api/admin/reports/:id'"
  ),
  'Admin reports mutation moved prematurely'
)


assert(
  app.includes(
    'const liveClients=new Map()'
  ),
  'Realtime lifecycle changed'
)


console.log(
  'MELEO v6.3.0 Report routes architecture check: OK'
)

console.log(
  '[PASS] public report intake modular'
)

console.log(
  '[PASS] authenticated write preserved'
)

console.log(
  '[PASS] validation/truncation contract preserved'
)

console.log(
  '[PASS] report SQL persistence preserved'
)

console.log(
  '[PASS] admin report management remains independently application-owned'
)

console.log(
  '[PASS] realtime SSE remains application-owned'
)
