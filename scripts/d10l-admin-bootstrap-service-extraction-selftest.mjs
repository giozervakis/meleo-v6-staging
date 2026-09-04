import fs from 'node:fs'

const app =
  fs.readFileSync(
    'server/relational/app.js',
    'utf8'
  )

const service =
  fs.readFileSync(
    'server/services/admin-bootstrap.service.js',
    'utf8'
  )

let failures = 0

function check(condition,label){
  if(condition){
    console.log(`[PASS] ${label}`)
  }else{
    failures++
    console.error(`[FAIL] ${label}`)
  }
}

check(
  app.includes(
    "admin-bootstrap.service.js"
  ),
  'app imports admin bootstrap service'
)

check(
  app.includes(
    'createAdminBootstrapService({'
  ),
  'app composes admin bootstrap service'
)

check(
  !app.includes(
    'async function ensureAdmin(){'
  ),
  'app no longer owns ensureAdmin implementation'
)

check(
  service.includes(
    'async function ensureAdmin(){'
  ),
  'service owns ensureAdmin implementation'
)

check(
  /createAdminBootstrapService\s*\(\s*\{[\s\S]*?config[\s\S]*?Users[\s\S]*?hashPassword[\s\S]*?now[\s\S]*?\}\s*\)/.test(
    service
  ),
  'service declares complete minimal DI'
)

check(
  service.includes(
    'config.admin.email'
  ),
  'admin email source preserved'
)

check(
  service.includes(
    'config.admin.password'
  ),
  'configured admin password source preserved'
)

check(
  service.includes(
    "config.isProd"
  ) &&
  service.includes(
    "'admin123'"
  ),
  'non-production fallback semantics preserved'
)

check(
  /config\.isProd[\s\S]*?\?[\s\S]*?''[\s\S]*?:[\s\S]*?'admin123'/.test(
    service
  ),
  'production receives no default admin password'
)

check(
  service.includes(
    'await Users.byEmail(email)'
  ),
  'existing admin lookup preserved'
)

check(
  service.includes(
    'await Users.create({'
  ),
  'admin creation preserved'
)

check(
  service.includes(
    "id:'u_admin'"
  ) &&
  service.includes(
    "role:'admin'"
  ) &&
  service.includes(
    "name:'MELEO Admin'"
  ),
  'admin identity semantics preserved'
)

check(
  service.includes(
    'emailVerified:true'
  ),
  'admin verified-email state preserved'
)

check(
  /acceptedTermsAt\s*:\s*[\r\n\s]*now\(\)/.test(
    service
  ),
  'admin accepted-terms timestamp preserved'
)

check(
  service.includes(
    'passwordHash:'
  ) &&
  service.includes(
    'await hashPassword(pass)'
  ),
  'new admin password hashing preserved'
)

check(
  /if\s*\(\s*config\.admin\.password\s*\)/.test(
    service
  ),
  'existing admin password rotation remains explicit'
)

check(
  service.includes(
    'await Users.update('
  ) &&
  service.includes(
    'password_hash:'
  ),
  'existing admin password update preserved'
)

check(
  app.includes(
    'async function ensureDemoData()'
  ),
  'demo seeding remains separately app-owned'
)

const composition =
  app.indexOf(
    'createAdminBootstrapService({'
  )

const demoCall =
  app.indexOf(
    'await ensureDemoData()'
  )

const adminCall =
  app.indexOf(
    'await ensureAdmin()'
  )

check(
  composition>=0 &&
  demoCall>composition &&
  adminCall>demoCall,
  'composition and startup order preserved'
)

check(
  !service.includes(
    'ensureDemoData'
  ),
  'admin service does not absorb demo seeding'
)

if(failures){
  console.error(
    `\nMELEO D10L.22 admin bootstrap extraction failed: ${failures}`
  )
  process.exit(1)
}

console.log(
  '\nMELEO D10L.22 admin bootstrap service extraction self-test: OK'
)
