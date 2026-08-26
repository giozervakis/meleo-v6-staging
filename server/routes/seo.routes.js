export function registerSeoRoutes({
  app,
  many,
  str,
  slugify
}) {
  app.get(
    '/api/seo/resolve',
    async (req,res) => {
      const specialtySlug =
        str(
          req.query.specialty,
          120
        )

      const citySlug =
        str(
          req.query.city,
          120
        )

      const rows =
        await many(
          `SELECT DISTINCT specialty,city
           FROM professionals
           WHERE verified=true
             AND admin_suspended=false
             AND subscription_status='active'
             AND specialty<>''
             AND city<>''
           LIMIT 3000`
        )

      const match =
        rows.find(
          x =>
            slugify(
              x.specialty
            ) === specialtySlug &&
            slugify(
              x.city
            ) === citySlug
        )

      if (!match) {
        return res
          .status(404)
          .json({
            error: 'Not found'
          })
      }

      res.json(match)
    }
  )
}
