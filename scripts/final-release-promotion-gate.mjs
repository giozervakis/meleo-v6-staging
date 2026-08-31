import fs from 'node:fs'
import {execFileSync} from 'node:child_process'

const pkg=
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

const failures=[]

function readJson(file){
  try{
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    )
  }
  catch{
    failures.push(
      'Missing or invalid evidence: '+file
    )

    return null
  }
}

function git(args){
  try{
    return execFileSync(
      'git',
      args,
      {
        encoding:'utf8',
        stdio:[
          'ignore',
          'pipe',
          'ignore'
        ]
      }
    ).trim()
  }
  catch{
    return 'unknown'
  }
}

const expectedRc =
  '7.0.0-rc.2'

if(
  pkg.version !== expectedRc
){
  failures.push(
    'Promotion gate must run from '+expectedRc+
    '; current package version is '+pkg.version
  )
}

if(
  process.env.NODE_ENV !==
  'production'
){
  failures.push(
    'NODE_ENV must be production'
  )
}

if(
  process.env.MELEO_DEPLOYMENT_ENV !==
  'production'
){
  failures.push(
    'MELEO_DEPLOYMENT_ENV must be production'
  )
}

if(
  process.env.LAUNCH_APPROVED !==
  'YES'
){
  failures.push(
    'LAUNCH_APPROVED must be YES after human release approval'
  )
}

if(
  process.env.PROMOTE_RELEASE !==
  'YES'
){
  failures.push(
    'PROMOTE_RELEASE must be YES for final v7.0.0 promotion'
  )
}

const go=
  readJson(
    'reports/release-go-no-go.json'
  )

if(
  go &&
  go.decision !== 'GO'
){
  failures.push(
    'release-go-no-go decision is not GO'
  )
}

if(
  go &&
  go.version !== pkg.version
){
  failures.push(
    'release-go-no-go version does not match RC package version'
  )
}

const maxAgeHours=
  Number(
    process.env.RELEASE_EVIDENCE_MAX_AGE_HOURS ||
    72
  )

if(go){
  const generated=
    Date.parse(
      go.generatedAt ||
      ''
    )

  const ageHours=
    (
      Date.now() -
      generated
    ) /
    3600000

  if(
    !Number.isFinite(generated) ||
    !Number.isFinite(ageHours) ||
    ageHours < 0 ||
    ageHours > maxAgeHours
  ){
    failures.push(
      'release-go-no-go evidence is stale or invalid'
    )
  }

  if(
    Array.isArray(go.blockers) &&
    go.blockers.length
  ){
    failures.push(
      'release-go-no-go still contains blockers'
    )
  }
}

const rcManifest=
  readJson(
    'reports/release-manifest-v'+
    pkg.version+
    '.json'
  )

if(rcManifest){
  if(
    rcManifest.version !==
    pkg.version
  ){
    failures.push(
      'RC release manifest version mismatch'
    )
  }

  if(
    rcManifest.channel !==
    'release-candidate'
  ){
    failures.push(
      'RC release manifest channel must be release-candidate'
    )
  }

  const head=
    git(
      [
        'rev-parse',
        'HEAD'
      ]
    )

  if(
    head === 'unknown'
  ){
    failures.push(
      'Unable to determine Git HEAD'
    )
  }
  else if(
    rcManifest.commit !==
    head
  ){
    failures.push(
      'RC release manifest commit does not match Git HEAD'
    )
  }
}

const requiredEvidence=[
  'reports/release-preflight.json',
  'reports/tls-readiness.json',
  'reports/infrastructure-readiness.json',
  'reports/stripe-readiness.json',
  'reports/backup-latest.json',
  'reports/restore-drill-latest.json',
  'reports/e2e-critical-latest.json',
  'reports/dr-evidence-gate-latest.json',
  'reports/dr-evidence-manifest.json'
]

for(
  const file
  of requiredEvidence
){
  if(
    !fs.existsSync(file)
  ){
    failures.push(
      'Required final release evidence missing: '+file
    )
  }
}

const report={
  sourceVersion:
    pkg.version,

  targetVersion:
    '7.0.0',

  checkedAt:
    new Date().toISOString(),

  commit:
    git(
      [
        'rev-parse',
        'HEAD'
      ]
    ),

  passed:
    failures.length === 0,

  failures
}

fs.mkdirSync(
  'reports',
  {
    recursive:true
  }
)

fs.writeFileSync(
  'reports/final-release-promotion-gate.json',
  JSON.stringify(
    report,
    null,
    2
  )+'\n',
  'utf8'
)

console.log(
  'MELEO RC3 final release promotion gate: '+
  (
    report.passed
      ? 'PASS'
      : 'FAIL'
  )
)

if(
  failures.length
){
  for(
    const failure
    of failures
  ){
    console.error(
      ' - '+failure
    )
  }
}

if(
  report.passed
){
  console.log(
    'RC 7.0.0-rc.2 is eligible for controlled promotion to v7.0.0.'
  )

  console.log(
    'No package version mutation was performed.'
  )
}

process.exitCode=
  report.passed
    ? 0
    : 1
