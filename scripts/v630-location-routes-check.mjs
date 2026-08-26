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

const location =
  fs.readFileSync(
    'server/routes/location.routes.js',
    'utf8'
  )

assert(
  app.includes(
    "import { registerLocationRoutes } from '../routes/location.routes.js'"
  ),
  'Location registrar import missing'
)

assert(
  app.includes(
    'registerLocationRoutes({'
  ),
  'Location registrar invocation missing'
)

assert(
  app.includes(
    'geocode,'
  ),
  'geocode dependency injection missing'
)

assert(
  app.includes(
    'async function geocode'
  ),
  'shared geocode infrastructure moved prematurely'
)

assert(
  !app.includes(
    "app.get('/api/location/search'"
  ),
  'Location search still application-owned'
)

assert(
  !app.includes(
    "app.get('/api/location/reverse'"
  ),
  'Location reverse still application-owned'
)

assert(
  location.includes(
    "'/api/location/search'"
  ),
  'Location search route missing'
)

assert(
  location.includes(
    "'/api/location/reverse'"
  ),
  'Location reverse route missing'
)

assert(
  location.includes(
    'limits.geo'
  ),
  'Location rate limit contract changed'
)

assert(
  location.includes(
    'str('
  ) &&
  location.includes(
    'req.query.q'
  ) &&
  location.includes(
    '200'
  ),
  'Location search input contract changed'
)

assert(
  location.includes(
    'encodeURIComponent(q)'
  ),
  'Location search encoding changed'
)

assert(
  location.includes(
    '/search?format=jsonv2&addressdetails=1&limit=5&q='
  ),
  'Location search geocode request changed'
)

assert(
  location.includes(
    '/reverse?format=jsonv2&addressdetails=1&lat='
  ),
  'Location reverse geocode request changed'
)

assert(
  location.includes(
    '!Number.isFinite(lat)'
  ) &&
  location.includes(
    '!Number.isFinite(lon)'
  ),
  'Location coordinate validation changed'
)

assert(
  location.includes(
    "'Invalid coordinates'"
  ),
  'Location invalid coordinate response changed'
)

assert(
  location.includes(
    "'geocode.search.failed'"
  ),
  'Location search logging changed'
)

assert(
  location.includes(
    "'geocode.reverse.failed'"
  ),
  'Location reverse logging changed'
)

assert(
  location.includes(
    "'Η υπηρεσία τοποθεσίας δεν είναι διαθέσιμη.'"
  ),
  'Location service error response changed'
)

assert(
  location.includes(
    '.status(503)'
  ),
  'Location service failure status changed'
)

for (
  const field of [
    'label:',
    'lat:',
    'lon:',
    'city:',
    'region:',
    'countryCode:',
    'country:'
  ]
) {
  assert(
    location.includes(field),
    `Location response field missing: ${field}`
  )
}

console.log(
  'MELEO v6.3.0 Location routes architecture check: OK'
)

console.log(
  '[PASS] location search modular'
)

console.log(
  '[PASS] location reverse modular'
)

console.log(
  '[PASS] geo rate limiting preserved'
)

console.log(
  '[PASS] search validation preserved'
)

console.log(
  '[PASS] coordinate validation preserved'
)

console.log(
  '[PASS] response contract preserved'
)

console.log(
  '[PASS] shared geocode infrastructure remains application-owned'
)

console.log(
  '[PASS] geocode injected into Location module'
)
