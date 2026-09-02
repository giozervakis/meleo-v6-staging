import http from 'node:http'
import {
  spawn
} from 'node:child_process'


if(
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase() ===
  'production'
){
  throw new Error(
    'D10F.8B refuses NODE_ENV=production'
  )
}


let failed =
  false


function pass(
  message
){
  console.log(
    '[PASS]',
    message
  )
}


function check(
  condition,
  message
){

  if(!condition){
    throw new Error(
      `[FAIL] ${message}`
    )
  }


  pass(
    message
  )
}


function listen(
  server
){

  return new Promise(
    (
      resolve,
      reject
    )=>{

      server.once(
        'error',
        reject
      )


      server.listen(
        {
          host:
            '127.0.0.1',

          port:
            0
        },
        ()=>resolve()
      )
    }
  )
}


function closeServer(
  server
){

  return new Promise(
    resolve=>{

      server.close(
        ()=>resolve()
      )


      /*
       * Hung keep-alive/socket cases must not make the
       * integration test teardown wait forever.
       */
      try{
        server.closeAllConnections?.()
      }catch{}
    }
  )
}


function runNodeModule(
  source,
  env,
  timeoutMs=10_000
){

  return new Promise(
    (
      resolve,
      reject
    )=>{

      const child =
        spawn(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            source
          ],
          {
            cwd:
              process.cwd(),

            env: {
              ...process.env,
              ...env
            },

            stdio: [
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        )


      let stdout =
        ''

      let stderr =
        ''


      child.stdout.on(
        'data',
        chunk=>{
          stdout +=
            chunk.toString()
        }
      )


      child.stderr.on(
        'data',
        chunk=>{
          stderr +=
            chunk.toString()
        }
      )


      const timer =
        setTimeout(
          ()=>{

            try{
              child.kill()
            }catch{}


            reject(
              new Error(
                `child timeout after ${timeoutMs}ms\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`
              )
            )

          },
          timeoutMs
        )


      child.once(
        'error',
        error=>{

          clearTimeout(
            timer
          )

          reject(
            error
          )
        }
      )


      child.once(
        'close',
        code=>{

          clearTimeout(
            timer
          )

          resolve({
            code,
            stdout,
            stderr
          })
        }
      )
    }
  )
}


function storageEnv(
  endpoint
){

  return {
    NODE_ENV:
      'test',

    STORAGE_DRIVER:
      's3',

    S3_ENDPOINT:
      endpoint,

    S3_REGION:
      'eu-central-1',

    S3_BUCKET:
      'meleo-d10f8b',

    S3_ACCESS_KEY_ID:
      'd10f8b-access',

    S3_SECRET_ACCESS_KEY:
      'd10f8b-secret',

    S3_REQUEST_TIMEOUT_MS:
      '500',

    SENSITIVE_DATA_KEY:
      'd10f8b-sensitive-data-key-0123456789abcdef'
  }
}


const childPreamble =
`
import path from 'node:path'
import {
  pathToFileURL
} from 'node:url'

const storage =
  await import(
    pathToFileURL(
      path.resolve(
        'server/object-storage.js'
      )
    ).href
  )
`


try{

  /*
   * ========================================================
   * CASE 1
   * S3 500 must propagate as controlled application error.
   * ========================================================
   */

  const errorServer =
    http.createServer(
      (
        req,
        res
      )=>{

        res.writeHead(
          500,
          {
            'content-type':
              'text/plain'
          }
        )

        res.end(
          'synthetic-s3-failure'
        )
      }
    )


  await listen(
    errorServer
  )


  const errorAddress =
    errorServer.address()


  const errorEndpoint =
    `http://127.0.0.1:${errorAddress.port}`


  try{

    const errorChild =
      await runNodeModule(
        childPreamble +
`
const {
  putVerificationObject
} = storage

let failure = null

try{
  await putVerificationObject(
    'verification/d10f8b/error.bin',
    Buffer.from(
      'failure-probe'
    )
  )
}
catch(error){
  failure = error
}

if(!failure){
  throw new Error(
    'Expected S3 500 failure was not observed'
  )
}

if(
  failure.status !==
  500
){
  throw new Error(
    'Expected propagated S3 status 500'
  )
}

if(
  !String(
    failure.message ||
    failure
  ).includes(
    'S3 PUT failed: 500'
  )
){
  throw new Error(
    'S3 failure message lost status context'
  )
}

console.log(
  'D10F8B_S3_500_OK'
)
`,
        storageEnv(
          errorEndpoint
        ),
        8_000
      )


    check(
      errorChild.code ===
        0,
      `S3 500 child exits cleanly${
        errorChild.stderr
          ? `: ${errorChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      errorChild.stdout.includes(
        'D10F8B_S3_500_OK'
      ),
      'S3 500 response propagates controlled storage error'
    )

  }
  finally{

    await closeServer(
      errorServer
    )
  }


  /*
   * ========================================================
   * CASE 2
   * Hung S3 endpoint must be aborted by production timeout.
   * ========================================================
   */

  let hungRequests =
    0


  const hungServer =
    http.createServer(
      (
        req,
        res
      )=>{

        hungRequests++

        /*
         * Deliberately never respond.
         * Production AbortSignal timeout must terminate client side.
         */
      }
    )


  await listen(
    hungServer
  )


  const hungAddress =
    hungServer.address()


  const hungEndpoint =
    `http://127.0.0.1:${hungAddress.port}`


  try{

    const timeoutChild =
      await runNodeModule(
        childPreamble +
`
const {
  putVerificationObject
} = storage

const started =
  Date.now()

let failure = null

try{
  await putVerificationObject(
    'verification/d10f8b/timeout.bin',
    Buffer.from(
      'timeout-probe'
    )
  )
}
catch(error){
  failure = error
}

const elapsed =
  Date.now() -
  started

if(!failure){
  throw new Error(
    'Expected storage timeout was not observed'
  )
}

if(
  !String(
    failure.message ||
    failure
  ).includes(
    'S3 PUT timeout'
  )
){
  throw new Error(
    'Storage timeout did not expose canonical timeout error'
  )
}

if(
  elapsed >
  4000
){
  throw new Error(
    'Storage request timeout exceeded runtime bound: ' +
    elapsed
  )
}

console.log(
  'D10F8B_S3_TIMEOUT_MS=' +
  elapsed
)

console.log(
  'D10F8B_S3_TIMEOUT_OK'
)
`,
        storageEnv(
          hungEndpoint
        ),
        8_000
      )


    check(
      timeoutChild.code ===
        0,
      `hung S3 child exits cleanly${
        timeoutChild.stderr
          ? `: ${timeoutChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      timeoutChild.stdout.includes(
        'D10F8B_S3_TIMEOUT_OK'
      ),
      'hung S3 request is aborted by production timeout'
    )


    check(
      hungRequests >=
        1,
      'failure injection reached real fake S3 endpoint'
    )

  }
  finally{

    await closeServer(
      hungServer
    )
  }


  /*
   * ========================================================
   * CASE 3
   * Healthy object-storage lifecycle after failure.
   *
   * Proves:
   * PUT
   * GET
   * DELETE
   * recovery after earlier timeout/failure
   * ========================================================
   */

  const objects =
    new Map()


  let putCount =
    0

  let getCount =
    0

  let deleteCount =
    0


  const healthyServer =
    http.createServer(
      async(
        req,
        res
      )=>{

        const requestUrl =
          new URL(
            req.url,
            'http://127.0.0.1'
          )


        const key =
          requestUrl.pathname


        if(
          req.method ===
          'PUT'
        ){

          const chunks =
            []


          for await(
            const chunk
            of req
          ){
            chunks.push(
              chunk
            )
          }


          objects.set(
            key,
            Buffer.concat(
              chunks
            )
          )


          putCount++


          res.writeHead(
            200
          )

          res.end()
          return
        }


        if(
          req.method ===
          'GET'
        ){

          getCount++


          if(
            !objects.has(
              key
            )
          ){

            res.writeHead(
              404
            )

            res.end()
            return
          }


          res.writeHead(
            200,
            {
              'content-type':
                'application/octet-stream'
            }
          )


          res.end(
            objects.get(
              key
            )
          )

          return
        }


        if(
          req.method ===
          'DELETE'
        ){

          deleteCount++


          objects.delete(
            key
          )


          res.writeHead(
            204
          )

          res.end()
          return
        }


        if(
          req.method ===
          'HEAD'
        ){

          res.writeHead(
            200
          )

          res.end()
          return
        }


        res.writeHead(
          405
        )

        res.end()
      }
    )


  await listen(
    healthyServer
  )


  const healthyAddress =
    healthyServer.address()


  const healthyEndpoint =
    `http://127.0.0.1:${healthyAddress.port}`


  try{

    const recoveryChild =
      await runNodeModule(
        childPreamble +
`
const {
  putVerificationObject,
  getVerificationObject,
  deleteVerificationObject,
  storageReady
} = storage

const key =
  'verification/d10f8b/recovery.bin'

const payload =
  Buffer.from(
    'MELEO-D10F8B-RECOVERY'
  )

const ready =
  await storageReady()

if(
  ready !==
  true
){
  throw new Error(
    'Healthy S3 endpoint did not pass storageReady'
  )
}

await putVerificationObject(
  key,
  payload
)

const loaded =
  await getVerificationObject(
    key
  )

if(
  !Buffer.from(
    loaded
  ).equals(
    payload
  )
){
  throw new Error(
    'Recovered S3 GET payload mismatch'
  )
}

await deleteVerificationObject(
  key
)

console.log(
  'D10F8B_S3_RECOVERY_OK'
)
`,
        storageEnv(
          healthyEndpoint
        ),
        10_000
      )


    check(
      recoveryChild.code ===
        0,
      `healthy S3 recovery child exits cleanly${
        recoveryChild.stderr
          ? `: ${recoveryChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      recoveryChild.stdout.includes(
        'D10F8B_S3_RECOVERY_OK'
      ),
      'object storage serves healthy lifecycle after injected failures'
    )


    check(
      putCount ===
        1,
      'recovery performs exactly one S3 PUT'
    )


    check(
      getCount ===
        1,
      'recovery performs exactly one S3 GET'
    )


    check(
      deleteCount ===
        1,
      'recovery performs exactly one S3 DELETE'
    )


    check(
      objects.size ===
        0,
      'successful DELETE leaves no fake S3 object residue'
    )

  }
  finally{

    await closeServer(
      healthyServer
    )
  }


  console.log('')
  console.log(
    'MELEO D10F.8B object-storage failure injection runtime: OK'
  )

}
catch(error){

  failed =
    true


  console.error(
    error?.stack ||
    String(error)
  )
}


if(
  failed
){
  process.exitCode =
    1
}