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
    'D10F.8C refuses NODE_ENV=production'
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


function mailEnv(
  endpoint
){

  return {
    NODE_ENV:
      'test',

    RESEND_API_KEY:
      're_d10f8c_test_key',

    RESEND_API_URL:
      endpoint,

    RESEND_REQUEST_TIMEOUT_MS:
      '500',

    MAIL_FROM:
      'MELEO <no-reply@meleo.test>',

    SUPPORT_EMAIL:
      'support@meleo.test'
  }
}


const childPreamble =
`
import path from 'node:path'
import {
  pathToFileURL
} from 'node:url'

const mailModule =
  await import(
    pathToFileURL(
      path.resolve(
        'server/mail.js'
      )
    ).href
  )

const {
  deliverEmail
} = mailModule
`


try{

  /*
   * ========================================================
   * CASE 1
   * Resend HTTP 500 must become controlled delivery failure.
   * ========================================================
   */

  let errorRequests =
    0


  const errorServer =
    http.createServer(
      async(
        req,
        res
      )=>{

        errorRequests++

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

        res.writeHead(
          500,
          {
            'content-type':
              'text/plain'
          }
        )

        res.end(
          'synthetic-resend-failure'
        )
      }
    )


  await listen(
    errorServer
  )


  const errorAddress =
    errorServer.address()


  const errorEndpoint =
    `http://127.0.0.1:${errorAddress.port}/emails`


  try{

    const errorChild =
      await runNodeModule(
        childPreamble +
`
const result =
  await deliverEmail({
    to:
      'failure@example.test',

    subject:
      'D10F.8C HTTP 500',

    html:
      '<p>failure</p>'
  })

if(
  result?.delivered !==
  false
){
  throw new Error(
    'Expected controlled failed delivery'
  )
}

if(
  !String(
    result.reason ||
    ''
  ).includes(
    'Resend 500'
  )
){
  throw new Error(
    'Expected Resend 500 reason'
  )
}

console.log(
  'D10F8C_RESEND_500_OK'
)
`,
        mailEnv(
          errorEndpoint
        ),
        8_000
      )


    check(
      errorChild.code ===
        0,
      `Resend 500 child exits cleanly${
        errorChild.stderr
          ? `: ${errorChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      errorChild.stdout.includes(
        'D10F8C_RESEND_500_OK'
      ),
      'Resend 500 becomes controlled delivery failure'
    )


    check(
      errorRequests ===
        1,
      'Resend 500 failure injection reaches fake provider exactly once'
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
   * Hung HTTP provider must be aborted by production timeout.
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
         * Production mail timeout must abort the request.
         */
      }
    )


  await listen(
    hungServer
  )


  const hungAddress =
    hungServer.address()


  const hungEndpoint =
    `http://127.0.0.1:${hungAddress.port}/emails`


  try{

    const timeoutChild =
      await runNodeModule(
        childPreamble +
`
const started =
  Date.now()

const result =
  await deliverEmail({
    to:
      'timeout@example.test',

    subject:
      'D10F.8C timeout',

    html:
      '<p>timeout</p>'
  })

const elapsed =
  Date.now() -
  started

if(
  result?.delivered !==
  false
){
  throw new Error(
    'Expected controlled timeout delivery failure'
  )
}

if(
  !String(
    result.reason ||
    ''
  ).includes(
    'Resend request timeout'
  )
){
  throw new Error(
    'Expected canonical Resend timeout reason'
  )
}

if(
  elapsed >
  4000
){
  throw new Error(
    'Mail request timeout exceeded runtime bound: ' +
    elapsed
  )
}

console.log(
  'D10F8C_RESEND_TIMEOUT_MS=' +
  elapsed
)

console.log(
  'D10F8C_RESEND_TIMEOUT_OK'
)
`,
        mailEnv(
          hungEndpoint
        ),
        8_000
      )


    check(
      timeoutChild.code ===
        0,
      `hung Resend child exits cleanly${
        timeoutChild.stderr
          ? `: ${timeoutChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      timeoutChild.stdout.includes(
        'D10F8C_RESEND_TIMEOUT_OK'
      ),
      'hung Resend request is aborted by production timeout'
    )


    check(
      hungRequests >=
        1,
      'mail timeout failure injection reaches real fake HTTP provider'
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
   * Healthy delivery after earlier failures.
   * ========================================================
   */

  let healthyRequests =
    0

  let lastAuthorization =
    ''

  let lastPayload =
    null


  const healthyServer =
    http.createServer(
      async(
        req,
        res
      )=>{

        healthyRequests++

        lastAuthorization =
          String(
            req.headers.authorization ||
            ''
          )


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


        try{

          lastPayload =
            JSON.parse(
              Buffer.concat(
                chunks
              ).toString(
                'utf8'
              )
            )

        }
        catch{

          lastPayload =
            null
        }


        res.writeHead(
          200,
          {
            'content-type':
              'application/json'
          }
        )


        res.end(
          JSON.stringify({
            id:
              'email_d10f8c'
          })
        )
      }
    )


  await listen(
    healthyServer
  )


  const healthyAddress =
    healthyServer.address()


  const healthyEndpoint =
    `http://127.0.0.1:${healthyAddress.port}/emails`


  try{

    const recoveryChild =
      await runNodeModule(
        childPreamble +
`
const result =
  await deliverEmail({
    to:
      'recovery@example.test',

    subject:
      'D10F.8C recovery\\r\\nInjected',

    html:
      '<p>recovery</p>'
  })

if(
  result?.delivered !==
  true
){
  throw new Error(
    'Expected successful recovered delivery'
  )
}

console.log(
  'D10F8C_RESEND_RECOVERY_OK'
)
`,
        mailEnv(
          healthyEndpoint
        ),
        8_000
      )


    check(
      recoveryChild.code ===
        0,
      `healthy Resend recovery child exits cleanly${
        recoveryChild.stderr
          ? `: ${recoveryChild.stderr.trim()}`
          : ''
      }`
    )


    check(
      recoveryChild.stdout.includes(
        'D10F8C_RESEND_RECOVERY_OK'
      ),
      'transactional mail recovers on healthy provider'
    )


    check(
      healthyRequests ===
        1,
      'recovery performs exactly one HTTP delivery request'
    )


    check(
      lastAuthorization ===
        'Bearer re_d10f8c_test_key',
      'mail provider Authorization header preserved'
    )


    check(
      lastPayload?.to?.[0] ===
        'recovery@example.test',
      'mail recipient payload preserved'
    )


    check(
      lastPayload?.subject ===
        'D10F.8C recoveryInjected',
      'mail subject CRLF sanitization preserved'
    )

  }
  finally{

    await closeServer(
      healthyServer
    )
  }


  /*
   * ========================================================
   * CASE 4
   * Missing provider key remains controlled / no external call.
   * ========================================================
   */

  const disabledChild =
    await runNodeModule(
      childPreamble +
`
const result =
  await deliverEmail({
    to:
      'disabled@example.test',

    subject:
      'D10F.8C disabled',

    html:
      '<p>disabled</p>'
  })

if(
  result?.delivered !==
  false ||
  result?.reason !==
  'mail_not_configured'
){
  throw new Error(
    'mail-disabled behavior changed'
  )
}

console.log(
  'D10F8C_MAIL_DISABLED_OK'
)
`,
      {
        NODE_ENV:
          'test',

        RESEND_API_KEY:
          '',

        RESEND_API_URL:
          'http://127.0.0.1:1/emails',

        RESEND_REQUEST_TIMEOUT_MS:
          '500'
      },
      5_000
    )


  check(
    disabledChild.code ===
      0,
    `disabled mail child exits cleanly${
      disabledChild.stderr
        ? `: ${disabledChild.stderr.trim()}`
        : ''
    }`
  )


  check(
    disabledChild.stdout.includes(
      'D10F8C_MAIL_DISABLED_OK'
    ),
    'mail-disabled fallback semantics preserved'
  )


  console.log('')
  console.log(
    'MELEO D10F.8C transactional-mail failure injection runtime: OK'
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