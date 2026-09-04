export function createOneTimeTokenService({
  newToken,
  sha256,
  tx,
  id
}) {
  if (typeof newToken !== 'function') {
    throw new TypeError('createOneTimeTokenService requires newToken')
  }
  if (typeof sha256 !== 'function') {
    throw new TypeError('createOneTimeTokenService requires sha256')
  }
  if (typeof tx !== 'function') {
    throw new TypeError('createOneTimeTokenService requires tx')
  }
  if (typeof id !== 'function') {
    throw new TypeError('createOneTimeTokenService requires id')
  }

  async function createToken(
    userId,
    type,
    ttl
  ){
    const raw=
      newToken()

    await tx(
      async client=>{

        await client.query(
          'DELETE FROM one_time_tokens WHERE user_id=$1 AND type=$2',
          [
            userId,
            type
          ]
        )

        await client.query(
          `
            INSERT INTO one_time_tokens(
              id,
              user_id,
              type,
              token_hash,
              expires_at
            )
            VALUES(
              $1,$2,$3,$4,
              now()+($5||' milliseconds')::interval
            )
          `,
          [
            id('tok'),
            userId,
            type,
            sha256(raw),
            String(ttl)
          ]
        )
      }
    )

    return raw
  }

  async function consumeToken(raw,type,client=null){
    const consume=async c=>{
      const {rows}=await c.query(
        `SELECT *
         FROM one_time_tokens
         WHERE token_hash=$1
           AND type=$2
           AND used_at IS NULL
           AND expires_at>now()
         FOR UPDATE`,
        [sha256(raw),type]
      )

      const r=rows[0]

      if(!r){
        return null
      }

      await c.query(
        'UPDATE one_time_tokens SET used_at=now() WHERE id=$1',
        [r.id]
      )

      return r
    }

    return client
      ? consume(client)
      : tx(consume)
  }

  return Object.freeze({
    createToken,
    consumeToken
  })
}
