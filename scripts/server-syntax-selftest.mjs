import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

/*
 * MELEO server-side JavaScript syntax gate.
 *
 * Purpose:
 * Prevent syntactically invalid backend or CI JavaScript from
 * reaching staging/production even when the Vite frontend build
 * succeeds.
 */

const ROOTS=[
  'server',
  'scripts'
]

const EXTENSIONS=
  new Set([
    '.js',
    '.mjs',
    '.cjs'
  ])

const IGNORED_DIRECTORIES=
  new Set([
    'node_modules',
    'dist',
    '.git'
  ])


function walk(dir){

  if(!fs.existsSync(dir)){
    return []
  }

  const files=[]

  for(
    const entry of fs.readdirSync(
      dir,
      {
        withFileTypes:true
      }
    )
  ){

    const target=
      path.join(
        dir,
        entry.name
      )

    if(entry.isDirectory()){

      if(
        IGNORED_DIRECTORIES.has(
          entry.name
        )
      ){
        continue
      }

      files.push(
        ...walk(target)
      )

      continue
    }

    if(
      entry.isFile() &&
      EXTENSIONS.has(
        path.extname(entry.name)
      )
    ){
      files.push(target)
    }
  }

  return files
}


const files=
  ROOTS
    .flatMap(walk)
    .sort()


if(files.length===0){
  console.error(
    'MELEO server syntax self-test: FAILED'
  )

  console.error(
    'No JavaScript files discovered.'
  )

  process.exit(1)
}


const failures=[]


for(const file of files){

  const result=
    spawnSync(
      process.execPath,
      [
        '--check',
        file
      ],
      {
        encoding:'utf8'
      }
    )

  if(result.error){

    failures.push({
      file,
      detail:
        result.error.message
    })

    continue
  }

  if(result.status!==0){

    failures.push({
      file,
      detail:
        (
          result.stderr ||
          result.stdout ||
          'Unknown syntax failure'
        ).trim()
    })
  }
}


if(failures.length){

  console.error('')
  console.error(
    'MELEO server syntax self-test: FAILED'
  )

  console.error(
    `${failures.length} invalid file(s) of ${files.length} checked.`
  )

  for(const failure of failures){

    console.error('')
    console.error(
      '========================================'
    )

    console.error(
      failure.file
    )

    console.error(
      '========================================'
    )

    console.error(
      failure.detail
    )
  }

  process.exit(1)
}


console.log(
  `[PASS] ${files.length}/${files.length} server/script JavaScript files parse successfully`
)

console.log(
  'MELEO server syntax self-test: OK'
)
