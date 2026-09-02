import crypto from 'node:crypto'
import net from 'node:net'
import { spawn } from 'node:child_process'
import pg from 'pg'

const sourceDatabaseUrl =
  String(
    process.env.DATABASE_URL ||
    ''
  ).trim()

if(!sourceDatabaseUrl){
  throw new Error(
    'DATABASE_URL is required for D10F.3 API integration'
  )
}

if(
  String(
    process.env.NODE_ENV ||
    ''
  ).toLowerCase() ===
  'production'
){
  throw new Error(
    'D10F.3 refuses NODE_ENV=production'
  )
}


const sourceUrl =
  new URL(
    sourceDatabaseUrl
  )

if(
  ![
    '127.0.0.1',
    'localhost',
    'db'
  ].includes(
    sourceUrl.hostname
  )
){
  throw new Error(
    `D10F.3 refuses non-local PostgreSQL host: ${sourceUrl.hostname}`
  )
}


const databaseName =
  'meleo_d10f_api_' +
  crypto
    .randomUUID()
    .replace(/-/g,'')


function urlForDatabase(name){

  const url =
    new URL(
      sourceDatabaseUrl
    )

  url.pathname =
    `/${name}`

  return url.toString()
}


const maintenanceDatabaseUrl =
  urlForDatabase(
    'postgres'
  )

const isolatedDatabaseUrl =
  urlForDatabase(
    databaseName
  )


function check(
  condition,
  message,
  detail=''
){
  if(!condition){

    const suffix =
      detail
        ? ` — ${detail}`
        : ''

    throw new Error(
      `[FAIL] ${message}${suffix}`
    )
  }

  console.log(
    `[PASS] ${message}`
  )
}


async function withClient(
  connectionString,
  fn
){

  const client =
    new pg.Client({
      connectionString
    })

  await client.connect()

  try{
    return await fn(client)
  }
  finally{
    await client.end()
  }
}


async function withAdminClient(fn){

  return withClient(
    maintenanceDatabaseUrl,
    fn
  )
}


async function createDatabase(){

  await withAdminClient(
    client =>
      client.query(
        `CREATE DATABASE "${databaseName}"`
      )
  )

  console.log(
    '[PASS] isolated API PostgreSQL database created'
  )
}


async function dropDatabase(){

  await withAdminClient(
    async client => {

      await client.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE
            datname=$1
            AND pid<>pg_backend_pid()
        `,
        [
          databaseName
        ]
      )

      await client.query(
        `DROP DATABASE IF EXISTS "${databaseName}"`
      )
    }
  )

  const exists =
    await withAdminClient(
      async client => {

        const result =
          await client.query(
            `
              SELECT 1
              FROM pg_database
              WHERE datname=$1
            `,
            [
              databaseName
            ]
          )

        return result.rows.length>0
      }
    )

  check(
    !exists,
    'isolated API PostgreSQL database cleanup verified'
  )
}


async function freePort(){

  return new Promise(
    (resolve,reject)=>{

      const server =
        net.createServer()

      server.unref()

      server.on(
        'error',
        reject
      )

      server.listen(
        {
          host:'127.0.0.1',
          port:0
        },
        ()=>{

          const address =
            server.address()

          const port =
            typeof address==='object'
              ? address.port
              : null

          server.close(
            error => {

              if(error){
                reject(error)
                return
              }

              resolve(port)
            }
          )
        }
      )
    }
  )
}


async function waitForApi(
  baseUrl,
  child,
  timeoutMs=30000
){

  const started =
    Date.now()

  while(
    Date.now()-started <
    timeoutMs
  ){

    if(
      child.exitCode !== null
    ){
      throw new Error(
        `MELEO API exited before readiness with code ${child.exitCode}`
      )
    }

    try{

      const response =
        await fetch(
          `${baseUrl}/api/ready`
        )

      if(response.ok){
        return
      }

    }
    catch{}

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          250
        )
    )
  }

  throw new Error(
    'Timed out waiting for isolated MELEO API readiness'
  )
}


function cookieFrom(response){

  const raw =
    response.headers.get(
      'set-cookie'
    ) || ''

  return raw
    .split(';')[0]
    .trim()
}


async function request(
  baseUrl,
  origin,
  method,
  path,
  {
    cookie='',
    body
  }={}
){

  const headers = {
    accept:
      'application/json',
    origin
  }

  if(
    body !== undefined
  ){
    headers['content-type'] =
      'application/json'
  }

  if(cookie){
    headers.cookie =
      cookie
  }

  const response =
    await fetch(
      `${baseUrl}${path}`,
      {
        method,
        redirect:'manual',
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body)
      }
    )

  let data =
    null

  const contentType =
    String(
      response.headers.get(
        'content-type'
      ) || ''
    )

  if(
    contentType.includes(
      'application/json'
    )
  ){
    try{
      data =
        await response.json()
    }
    catch{}
  }

  return {
    response,
    status:
      response.status,
    data,
    cookie:
      cookieFrom(response)
  }
}


async function login(
  baseUrl,
  origin,
  email,
  password
){

  return request(
    baseUrl,
    origin,
    'POST',
    '/api/auth/login',
    {
      body:{
        email,
        password
      }
    }
  )
}


async function dbOne(
  text,
  params=[]
){

  return withClient(
    isolatedDatabaseUrl,
    async client => {

      const result =
        await client.query(
          text,
          params
        )

      return (
        result.rows[0] ||
        null
      )
    }
  )
}


async function dbMany(
  text,
  params=[]
){

  return withClient(
    isolatedDatabaseUrl,
    async client => {

      const result =
        await client.query(
          text,
          params
        )

      return result.rows
    }
  )
}


async function stopChild(child){

  if(
    !child ||
    child.exitCode !== null
  ){
    return
  }

  const exited =
    new Promise(
      resolve =>
        child.once(
          'exit',
          ()=>resolve(true)
        )
    )

  try{
    child.kill(
      'SIGTERM'
    )
  }
  catch{}

  const graceful =
    await Promise.race([
      exited,
      new Promise(
        resolve =>
          setTimeout(
            ()=>resolve(false),
            10000
          )
      )
  ])

  if(
    !graceful &&
    child.exitCode === null
  ){
    try{
      child.kill(
        'SIGKILL'
      )
    }
    catch{}

    await Promise.race([
      exited,
      new Promise(
        resolve =>
          setTimeout(
            resolve,
            5000
          )
      )
    ])
  }
}


let apiProcess =
  null

let stdout =
  ''

let stderr =
  ''


try{

  await createDatabase()


  const port =
    await freePort()

  check(
    Number.isInteger(port) &&
    port>0,
    'ephemeral API port reserved'
  )


  const baseUrl =
    `http://127.0.0.1:${port}`

  const origin =
    baseUrl


  apiProcess =
    spawn(
      process.execPath,
      [
        'server/index.js'
      ],
      {
        cwd:
          process.cwd(),

        stdio:[
          'ignore',
          'pipe',
          'pipe'
        ],

        env:{
          ...process.env,

          NODE_ENV:
            'test',

          DATABASE_URL:
            isolatedDatabaseUrl,

          DATABASE_SSL:
            '0',

          DATABASE_POOL_MAX:
            '5',

          REDIS_URL:
            '',

          REDIS_REQUIRED:
            '0',

          PORT:
            String(port),

          APP_URL:
            origin,

          E2E_MODE:
            '1',

          SEED_DEMO:
            '1',

          DEMO_AUTH:
            '1',

          DEMO_CHECKOUT:
            '1',

          ADMIN_EMAIL:
            'admin@meleo.gr',

          ADMIN_PASSWORD:
            'admin123',

          STORAGE_DRIVER:
            'local',

          RESEND_API_KEY:
            '',

          STRIPE_SECRET_KEY:
            '',

          SENSITIVE_DATA_KEY:
            'd10f3-test-sensitive-data-key-000000000000'
        }
      }
    )


  apiProcess.stdout.on(
    'data',
    chunk => {

      stdout +=
        chunk.toString()

      if(stdout.length>30000){
        stdout =
          stdout.slice(-30000)
      }
    }
  )

  apiProcess.stderr.on(
    'data',
    chunk => {

      stderr +=
        chunk.toString()

      if(stderr.length>30000){
        stderr =
          stderr.slice(-30000)
      }
    }
  )


  await waitForApi(
    baseUrl,
    apiProcess
  )

  check(
    true,
    'real MELEO relational API reached readiness'
  )


  const schema =
    await dbOne(
      `
        SELECT
          to_regclass('public.users') users,
          to_regclass('public.professionals') professionals,
          to_regclass('public.bookings') bookings,
          to_regclass('public.sessions') sessions
      `
    )

  check(
    schema?.users &&
    schema?.professionals &&
    schema?.bookings &&
    schema?.sessions,
    'production schema exists in isolated API database'
  )


  const seededUsers =
    await dbMany(
      `
        SELECT
          id,
          role,
          email
        FROM users
        ORDER BY id
      `
    )

  check(
    seededUsers.some(
      row =>
        row.id==='u_patient' &&
        row.role==='patient' &&
        row.email==='patient@meleo.gr'
    ),
    'deterministic patient seed exists'
  )

  check(
    seededUsers.some(
      row =>
        row.id==='u_nurse1' &&
        row.role==='professional' &&
        row.email==='maria@meleo.gr'
    ),
    'deterministic professional seed exists'
  )


  const unauthenticated =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/bookings'
    )

  check(
    unauthenticated.status===401,
    'protected booking API rejects unauthenticated request'
  )


  const publicSearch =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/professionals?limit=20'
    )

  const professionals =
    Array.isArray(
      publicSearch.data?.items
    )
      ? publicSearch.data.items
      : (
          Array.isArray(
            publicSearch.data
          )
            ? publicSearch.data
            : []
        )

  check(
    publicSearch.status===200,
    'public professional API returns 200'
  )

  check(
    professionals.some(
      professional =>
        professional.id==='p1'
    ),
    'public professional API exposes seeded visible professional'
  )


  const patient =
    await login(
      baseUrl,
      origin,
      'patient@meleo.gr',
      'demo123'
    )

  check(
    patient.status===200 &&
    Boolean(patient.cookie),
    'patient login returns authenticated session cookie'
  )


  const patientMe =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/me',
      {
        cookie:
          patient.cookie
      }
    )

  check(
    patientMe.status===200 &&
    patientMe.data?.user?.id==='u_patient' &&
    patientMe.data?.user?.role==='patient',
    'patient session resolves through /api/me'
  )


  const professional =
    await login(
      baseUrl,
      origin,
      'maria@meleo.gr',
      'demo123'
    )

  check(
    professional.status===200 &&
    Boolean(professional.cookie),
    'professional login returns authenticated session cookie'
  )


  const otherProfessional =
    await login(
      baseUrl,
      origin,
      'nikos@meleo.gr',
      'demo123'
    )

  check(
    otherProfessional.status===200 &&
    Boolean(
      otherProfessional.cookie
    ),
    'second professional login succeeds for authorization test'
  )


  const invalidLogin =
    await login(
      baseUrl,
      origin,
      'nobody@example.invalid',
      'wrong-password'
    )

  check(
    [
      400,
      401
    ].includes(
      invalidLogin.status
    ),
    'invalid login is rejected'
  )


  const invalidOrigin =
    await request(
      baseUrl,
      'http://invalid-origin.example',
      'POST',
      '/api/bookings',
      {
        cookie:
          patient.cookie,

        body:{
          professionalId:
            'p1',

          service:
            'Απλή νοσηλευτική επίσκεψη',

          date:
            '2030-01-07',

          time:
            '09:00'
        }
      }
    )

  check(
    invalidOrigin.status===403,
    'mutation API rejects invalid Origin'
  )


  const invalidBooking =
    await request(
      baseUrl,
      origin,
      'POST',
      '/api/bookings',
      {
        cookie:
          patient.cookie,

        body:{
          professionalId:
            'p1',

          service:
            '',

          date:
            'not-a-date',

          time:
            '99:99'
        }
      }
    )

  check(
    invalidBooking.status===400,
    'booking API rejects invalid payload'
  )


  const availability =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/professionals/p1/availability?date=2030-01-07'
    )

  check(
    availability.status===200 &&
    Array.isArray(
      availability.data?.slots
    ) &&
    availability.data.slots.includes(
      '09:00'
    ),
    'public availability exposes deterministic bookable slot'
  )


  const createBooking =
    await request(
      baseUrl,
      origin,
      'POST',
      '/api/bookings',
      {
        cookie:
          patient.cookie,

        body:{
          professionalId:
            'p1',

          service:
            'Απλή νοσηλευτική επίσκεψη',

          date:
            '2030-01-07',

          time:
            '09:00',

          address:
            'D10F.3 Integration Address',

          notes:
            'D10F.3 API runtime test',

          repeat:
            'Μία φορά'
        }
      }
    )


  check(
    createBooking.status===200 &&
    Boolean(
      createBooking.data?.booking?.id
    ),
    'booking creation succeeds through real HTTP API'
  )


  const bookingId =
    createBooking.data.booking.id


  const persisted =
    await dbOne(
      `
        SELECT
          id,
          patient_id,
          professional_id,
          service,
          status,
          visit_date::text,
          to_char(
            visit_time,
            'HH24:MI'
          ) visit_time
        FROM bookings
        WHERE id=$1
      `,
      [
        bookingId
      ]
    )


  check(
    persisted?.id===bookingId &&
    persisted?.patient_id==='u_patient' &&
    persisted?.professional_id==='p1' &&
    persisted?.service===
      'Απλή νοσηλευτική επίσκεψη' &&
    persisted?.status==='pending' &&
    persisted?.visit_time==='09:00',
    'booking API write is persisted in PostgreSQL'
  )


  const bookingNotification =
    await dbOne(
      `
        SELECT
          user_id,
          type
        FROM notifications
        WHERE
          user_id='u_nurse1'
          AND type='booking'
        ORDER BY created_at DESC
        LIMIT 1
      `
    )

  check(
    bookingNotification?.user_id===
      'u_nurse1',
    'booking creation durable notification persisted'
  )


  const patientList =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/bookings',
      {
        cookie:
          patient.cookie
      }
    )

  const patientBookings =
    Array.isArray(
      patientList.data?.items
    )
      ? patientList.data.items
      : (
          Array.isArray(
            patientList.data
          )
            ? patientList.data
            : []
        )

  check(
    patientList.status===200 &&
    patientBookings.some(
      booking =>
        booking.id===bookingId
    ),
    'patient booking list returns persisted booking'
  )


  const forbiddenTransition =
    await request(
      baseUrl,
      origin,
      'PATCH',
      `/api/bookings/${bookingId}/status`,
      {
        cookie:
          otherProfessional.cookie,

        body:{
          status:
            'accepted'
        }
      }
    )

  check(
    forbiddenTransition.status===403,
    'unrelated professional cannot mutate booking'
  )


  const stillPending =
    await dbOne(
      `
        SELECT status
        FROM bookings
        WHERE id=$1
      `,
      [
        bookingId
      ]
    )

  check(
    stillPending?.status==='pending',
    'forbidden API mutation leaves database unchanged'
  )


  const invalidStatus =
    await request(
      baseUrl,
      origin,
      'PATCH',
      `/api/bookings/${bookingId}/status`,
      {
        cookie:
          professional.cookie,

        body:{
          status:
            'not-a-real-status'
        }
      }
    )

  check(
    invalidStatus.status===400 &&
    invalidStatus.data?.code===
      'BOOKING_TARGET_STATUS_INVALID',
    'booking API rejects invalid target status'
  )


  const accepted =
    await request(
      baseUrl,
      origin,
      'PATCH',
      `/api/bookings/${bookingId}/status`,
      {
        cookie:
          professional.cookie,

        body:{
          status:
            'accepted'
        }
      }
    )

  check(
    accepted.status===200 &&
    accepted.data?.booking?.status===
      'accepted',
    'owning professional can accept pending booking'
  )


  const acceptedRow =
    await dbOne(
      `
        SELECT status
        FROM bookings
        WHERE id=$1
      `,
      [
        bookingId
      ]
    )

  check(
    acceptedRow?.status==='accepted',
    'booking state transition persists in PostgreSQL'
  )


  const unavailableAfterBooking =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/professionals/p1/availability?date=2030-01-07'
    )

  check(
    unavailableAfterBooking.status===200 &&
    Array.isArray(
      unavailableAfterBooking.data?.slots
    ) &&
    !unavailableAfterBooking.data.slots.includes(
      '09:00'
    ),
    'accepted booking removes occupied slot from availability'
  )


  const duplicateSlot =
    await request(
      baseUrl,
      origin,
      'POST',
      '/api/bookings',
      {
        cookie:
          patient.cookie,

        body:{
          professionalId:
            'p1',

          service:
            'Απλή νοσηλευτική επίσκεψη',

          date:
            '2030-01-07',

          time:
            '09:00'
        }
      }
    )

  check(
    duplicateSlot.status===409 &&
    [
      'BOOKING_SLOT_UNAVAILABLE',
      'BOOKING_SLOT_CONFLICT'
    ].includes(
      duplicateSlot.data?.code
    ),
    'occupied booking slot is rejected'
  )


  const count =
    await dbOne(
      `
        SELECT count(*)::int count
        FROM bookings
        WHERE
          professional_id='p1'
          AND visit_date='2030-01-07'
          AND visit_time='09:00'
      `
    )

  check(
    Number(
      count?.count || 0
    )===1,
    'duplicate slot rejection leaves exactly one booking'
  )


  const professionalList =
    await request(
      baseUrl,
      origin,
      'GET',
      '/api/bookings',
      {
        cookie:
          professional.cookie
      }
    )

  const professionalBookings =
    Array.isArray(
      professionalList.data?.items
    )
      ? professionalList.data.items
      : (
          Array.isArray(
            professionalList.data
          )
            ? professionalList.data
            : []
        )

  check(
    professionalList.status===200 &&
    professionalBookings.some(
      booking =>
        booking.id===bookingId &&
        booking.status==='accepted'
    ),
    'professional booking list reflects accepted state'
  )


  console.log('')
  console.log(
    'MELEO D10F.3 API integration runtime: OK'
  )

}
catch(error){

  console.error('')
  console.error(
    error?.stack ||
    error
  )

  if(stdout.trim()){
    console.error('')
    console.error(
      '--- isolated API stdout ---'
    )
    console.error(
      stdout.trim()
    )
  }

  if(stderr.trim()){
    console.error('')
    console.error(
      '--- isolated API stderr ---'
    )
    console.error(
      stderr.trim()
    )
  }

  process.exitCode =
    1

}
finally{

  try{

    await stopChild(
      apiProcess
    )

    if(apiProcess){
      console.log(
        '[PASS] isolated MELEO API process stopped'
      )
    }

  }
  catch(error){

    console.error(
      '[WARN] API shutdown:',
      error?.message ||
      error
    )

    process.exitCode =
      1
  }


  try{

    await dropDatabase()

  }
  catch(error){

    console.error(
      '[FAIL] isolated database cleanup:',
      error?.stack ||
      error
    )

    process.exitCode =
      1
  }

}
