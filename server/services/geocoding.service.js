/*
 * MELEO geocoding service.
 *
 * Owns:
 * - Redis geocode cache
 * - PostgreSQL persistent geocode cache
 * - fixture provider for non-production verification
 * - Mapbox provider adaptation
 * - Nominatim provider access
 *
 * Route validation / response shaping remains in
 * server/routes/location.routes.js.
 */
export function createGeocodeService({
  config,
  sha256,
  redisGetJson,
  redisSetJson,
  one,
  sql,
  env=process.env,
  fetchImpl=globalThis.fetch,
  warn=console.warn
}){
  return async function geocode(
    pathname
  ){
    const key =
      sha256(
        pathname
      )


    /*
     * L1 cache: Redis.
     */
    if(config.redis.url){
      try{
        const hit =
          await redisGetJson(
            config.redis.keyPrefix +
            'geo:' +
            key
          )

        if(hit){
          return hit
        }
      }catch(err){
        warn(
          '[MELEO v5.1] Redis geocode cache fallback:',
          err.message
        )
      }
    }


    /*
     * L2 cache: PostgreSQL.
     */
    const cached =
      await one(
        'SELECT payload FROM geocode_cache WHERE cache_key=$1 AND expires_at>now()',
        [
          key
        ]
      )

    if(cached){
      if(config.redis.url){
        redisSetJson(
          config.redis.keyPrefix +
          'geo:' +
          key,
          cached.payload,
          86400
        ).catch(()=>{})
      }

      return cached.payload
    }


    const provider =
      (
        env.GEOCODING_PROVIDER ||
        'nominatim'
      ).toLowerCase()


    /*
     * Deterministic fixture provider.
     * Never permitted in production.
     */
    if(provider === 'fixture'){
      if(config.isProd){
        throw new Error(
          'Fixture geocoding is forbidden in production'
        )
      }

      const params =
        new URLSearchParams(
          pathname.split('?')[1] ||
          ''
        )


      if(
        pathname.startsWith(
          '/search'
        )
      ){
        const query =
          String(
            params.get('q') ||
            ''
          )
            .trim()
            .toLocaleLowerCase(
              'el-GR'
            )

        const known =
          query.includes(
            'ηράκλειο'
          ) ||
          query.includes(
            'heraklion'
          ) ||
          query.includes(
            'iraklio'
          )

        const data =
          known
            ? [{
                lat:'35.3387',
                lon:'25.1442',
                display_name:'Ηράκλειο, Κρήτη, Ελλάδα',
                address:{
                  city:'Ηράκλειο',
                  state:'Κρήτη',
                  country:'Ελλάδα',
                  country_code:'gr'
                }
              }]
            : []


        await persist(
          key,
          data
        )

        return data
      }


      if(
        pathname.startsWith(
          '/reverse'
        )
      ){
        const lat =
          Number(
            params.get('lat')
          )

        const lon =
          Number(
            params.get('lon')
          )

        if(
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ){
          throw new Error(
            'Invalid fixture coordinates'
          )
        }


        const data = {
          lat:String(lat),
          lon:String(lon),
          display_name:'Ηράκλειο, Κρήτη, Ελλάδα',
          address:{
            city:'Ηράκλειο',
            state:'Κρήτη',
            country:'Ελλάδα',
            country_code:'gr'
          }
        }


        await persist(
          key,
          data
        )

        return data
      }


      throw new Error(
        'Unsupported fixture geocoding request'
      )
    }


    /*
     * External provider request.
     */
    let url
    let headers = {}


    if(
      provider === 'mapbox' &&
      env.MAPBOX_TOKEN
    ){
      const queryParams =
        new URLSearchParams(
          pathname.split('?')[1] ||
          ''
        )

      const query =
        queryParams.get('q') ||
        ''

      url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(env.MAPBOX_TOKEN)}&language=el&limit=5`
    }
    else{
      url =
        `https://nominatim.openstreetmap.org${pathname}`

      headers = {
        'User-Agent':
          `MELEO-Marketplace/5.0 (${config.mail.supportEmail})`,
        'Accept-Language':
          'el,en'
      }
    }


    const response =
      await fetchImpl(
        url,
        {
          headers
        }
      )


    if(!response.ok){
      throw new Error(
        'Geocoding unavailable'
      )
    }


    let data =
      await response.json()


    /*
     * Adapt Mapbox response to the same contract used by
     * the existing location routes.
     */
    if(
      provider === 'mapbox' &&
      data.features
    ){
      data =
        data.features.map(
          feature=>({
            lat:
              String(
                feature.center[1]
              ),

            lon:
              String(
                feature.center[0]
              ),

            display_name:
              feature.place_name,

            address:{
              city:
                feature.context?.find(
                  item=>
                    item.id.startsWith(
                      'place.'
                    )
                )?.text ||
                feature.text,

              country:
                feature.context?.find(
                  item=>
                    item.id.startsWith(
                      'country.'
                    )
                )?.text ||
                ''
            }
          })
        )
    }


    await persist(
      key,
      data
    )

    return data


    async function persist(
      cacheKey,
      payload
    ){
      await sql(
        `INSERT INTO geocode_cache(cache_key,payload,expires_at)
         VALUES($1,$2,now()+interval '30 days')
         ON CONFLICT(cache_key)
         DO UPDATE SET
           payload=$2,
           expires_at=now()+interval '30 days',
           updated_at=now()`,
        [
          cacheKey,
          JSON.stringify(
            payload
          )
        ]
      )


      if(config.redis.url){
        redisSetJson(
          config.redis.keyPrefix +
          'geo:' +
          cacheKey,
          payload,
          30 * 86400
        ).catch(()=>{})
      }
    }
  }
}
