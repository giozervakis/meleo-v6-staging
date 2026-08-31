import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const packageInfo =
  JSON.parse(
    fs.readFileSync(
      'package.json',
      'utf8'
    )
  )

function gitCommit(){
  const fromEnvironment =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    ''

  if(fromEnvironment){
    return fromEnvironment.trim()
  }

  try{
    return execFileSync(
      'git',
      ['rev-parse','HEAD'],
      {
        encoding:'utf8',
        stdio:[
          'ignore',
          'pipe',
          'ignore'
        ]
      }
    ).trim()
  }catch{
    return 'unknown'
  }
}

const roots=[
  'package.json',
  'package-lock.json',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  'server',
  'src',
  'migrations',
  'deploy',
  '.github',
  'scripts'
]

const skip=
  new Set([
    'reports',
    'node_modules',
    'dist',
    '.git'
  ])

const files=[]

function walk(p){
  if(!fs.existsSync(p)){
    return
  }

  const stat=
    fs.statSync(p)

  if(stat.isDirectory()){
    if(skip.has(path.basename(p))){
      return
    }

    for(const name of fs.readdirSync(p).sort()){
      walk(path.join(p,name))
    }

    return
  }

  files.push(
    p.replaceAll(
      '\\',
      '/'
    )
  )
}

for(const root of roots){
  walk(root)
}

const entries=
  files.map(file=>({
    file,
    sha256:
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(file))
        .digest('hex'),
    sizeBytes:
      fs.statSync(file).size
  }))

const commit=
  gitCommit()

const manifest={
  product:'MELEO',
  version:packageInfo.version,
  channel:packageInfo.version.includes('-rc.')?'release-candidate':'production',
  commit,
  commitShort:
    commit==='unknown'
      ? 'unknown'
      : commit.slice(0,7),
  generatedAt:
    new Date().toISOString(),
  files:entries
}

fs.mkdirSync(
  'reports',
  {recursive:true}
)

const output=
  `reports/release-manifest-v${packageInfo.version}.json`

fs.writeFileSync(
  output,
  JSON.stringify(
    manifest,
    null,
    2
  )
)

console.log(
  `MELEO v${packageInfo.version} release manifest: ${entries.length} files hashed · commit ${manifest.commitShort}`
)