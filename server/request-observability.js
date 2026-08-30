import {
  log,
  requestId
} from './logger.js'

const REQUEST_ID_HEADER =
  'x-request-id'

function normalizedPath(req) {
  return (
    req.route?.path ||
    req.path ||
    '/'
  )
}

export function requestObservability(
  req,
  res,
  next
) {
  const correlationId =
    requestId(
      req.get(
        REQUEST_ID_HEADER
      )
    )

  const startedAt =
    process.hrtime.bigint()

  req.id =
    correlationId

  req.requestId =
    correlationId

  res.setHeader(
    'X-Request-Id',
    correlationId
  )

  log.info(
    'http.request.started',
    {
      requestId:
        correlationId,

      method:
        req.method,

      path:
        normalizedPath(req)
    }
  )

  let completed =
    false

  const emitCompletion =
    outcome => {

      if (completed) {
        return
      }

      completed =
        true

      const elapsedNs =
        process.hrtime.bigint() -
        startedAt

      const durationMs =
        Number(elapsedNs) /
        1e6

      const meta = {
        requestId:
          correlationId,

        method:
          req.method,

        path:
          normalizedPath(req),

        statusCode:
          res.statusCode,

        durationMs:
          Number(
            durationMs.toFixed(1)
          ),

        outcome
      }

      if (
        res.statusCode >= 500
      ) {
        log.error(
          'http.request.completed',
          meta
        )

        return
      }

      if (
        res.statusCode >= 400
      ) {
        log.warn(
          'http.request.completed',
          meta
        )

        return
      }

      log.info(
        'http.request.completed',
        meta
      )
    }

  res.once(
    'finish',
    () =>
      emitCompletion(
        'finished'
      )
  )

  res.once(
    'close',
    () => {
      if (
        !res.writableEnded
      ) {
        emitCompletion(
          'aborted'
        )
      }
    }
  )

  next()
}