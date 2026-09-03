/*
 * MELEO live-event runtime.
 *
 * Owns:
 * - PostgreSQL LISTEN/NOTIFY subscription
 * - in-process SSE client registry
 * - /api/live SSE transport
 * - live-client shutdown
 * - PostgreSQL listener shutdown
 *
 * The HTTP server lifecycle remains owned by relational/app.js.
 */
export async function createLiveEventRuntime(
  app,
  {
    auth,
    getPool,
    one
  }
){
  const liveClients =
    new Map()

  const listener =
    await getPool().connect()

  await listener.query(
    'LISTEN meleo_live'
  )

  listener.on(
    'notification',
    msg=>{
      let meta

      try{
        meta =
          JSON.parse(
            msg.payload ||
            '{}'
          )
      }catch{
        return
      }

      const uid =
        meta.userId

      const clients =
        liveClients.get(
          uid
        )

      if(!clients?.size){
        return
      }

      one(
        'SELECT payload FROM live_events WHERE id=$1 AND user_id=$2',
        [
          meta.eventId,
          uid
        ]
      )
        .then(event=>{
          if(!event){
            return
          }

          for(
            const response
            of [...clients]
          ){
            try{
              response.write(
                `event: meleo\ndata: ${JSON.stringify(event.payload)}\n\n`
              )
            }catch{
              clients.delete(
                response
              )
            }
          }
        })
        .catch(()=>{})
    }
  )


  app.get(
    '/api/live',
    auth,
    async(
      req,
      res
    )=>{
      res.setHeader(
        'Content-Type',
        'text/event-stream'
      )

      res.setHeader(
        'Cache-Control',
        'no-cache'
      )

      res.setHeader(
        'Connection',
        'keep-alive'
      )

      res.flushHeaders?.()

      const set =
        liveClients.get(
          req.user.id
        ) ||
        new Set()

      set.add(
        res
      )

      liveClients.set(
        req.user.id,
        set
      )

      res.write(
        'event: ready\n' +
        'data: {}\n\n'
      )

      const ping =
        setInterval(
          ()=>{
            try{
              res.write(
                ': ping\n\n'
              )
            }catch{}
          },
          25000
        )

      req.on(
        'close',
        ()=>{
          clearInterval(
            ping
          )

          set.delete(
            res
          )

          if(!set.size){
            liveClients.delete(
              req.user.id
            )
          }
        }
      )
    }
  )


  function closeClients(){
    for(
      const clients
      of liveClients.values()
    ){
      for(
        const client
        of clients
      ){
        try{
          client.write(
            'event: shutdown\n' +
            'data: {"reason":"server_restart"}\n\n'
          )
        }catch{}

        try{
          client.end()
        }catch{}
      }
    }

    liveClients.clear()
  }


  async function closeListener(){
    let unlistenError =
      null

    try{
      await listener.query(
        'UNLISTEN meleo_live'
      )
    }catch(err){
      unlistenError =
        err
    }

    try{
      listener.release()
    }catch{}

    if(unlistenError){
      throw unlistenError
    }
  }


  return {
    closeClients,
    closeListener
  }
}
