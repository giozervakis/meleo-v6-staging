export function registerLocationRoutes({
  app,
  limits,
  str,
  geocode,
  log
}) {
  app.get(
    '/api/location/search',
    limits.geo,
    async (req,res) => {
      const q =
        str(
          req.query.q,
          200
        )

      if (!q) {
        return res.json([])
      }

      try {
        const raw =
          (
            await geocode(
              `/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`
            )
          ).slice(0,5)

        res.json(
          raw.map(
            x => {
              const a =
                x.address || {}

              return {
                label:
                  x.display_name || '',
                lat:
                  Number(x.lat),
                lon:
                  Number(x.lon),
                city:
                  a.city ||
                  a.town ||
                  a.village ||
                  a.municipality ||
                  a.county ||
                  '',
                region:
                  a.state ||
                  a.region ||
                  '',
                countryCode:
                  String(
                    a.country_code || ''
                  ).toLowerCase(),
                country:
                  a.country || ''
              }
            }
          )
        )
      }
      catch (err) {
        log.error(
          'geocode.search.failed',
          {
            message:
              err?.message ||
              String(err)
          }
        )

        res
          .status(503)
          .json({
            error:
              'Η υπηρεσία τοποθεσίας δεν είναι διαθέσιμη.'
          })
      }
    }
  )

  app.get(
    '/api/location/reverse',
    limits.geo,
    async (req,res) => {
      const lat =
        Number(req.query.lat)

      const lon =
        Number(req.query.lon)

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        return res
          .status(400)
          .json({
            error:
              'Invalid coordinates'
          })
      }

      try {
        const x =
          await geocode(
            `/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lon}`
          )

        const a =
          x.address || {}

        res.json({
          label:
            x.display_name || '',
          lat,
          lon,
          city:
            a.city ||
            a.town ||
            a.village ||
            a.municipality ||
            a.county ||
            '',
          region:
            a.state ||
            a.region ||
            '',
          countryCode:
            String(
              a.country_code || ''
            ).toLowerCase(),
          country:
            a.country || ''
        })
      }
      catch (err) {
        log.error(
          'geocode.reverse.failed',
          {
            message:
              err?.message ||
              String(err)
          }
        )

        res
          .status(503)
          .json({
            error:
              'Η υπηρεσία τοποθεσίας δεν είναι διαθέσιμη.'
          })
      }
    }
  )
}
