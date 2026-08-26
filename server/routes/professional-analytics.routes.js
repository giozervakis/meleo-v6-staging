export function registerProfessionalAnalyticsRoutes(
  app,
  {
    auth,
    requireRole,
    Professionals,
    Analytics,
    meleoTrustForProfessional,
    smartMatchDiagnosticsForProfessional
  }
) {

  app.get(
    '/api/professional/analytics',
    auth,
    requireRole('professional'),
    async(req,res)=>{
      const p=
        await Professionals.byUser(
          req.user.id
        )

      if(!p){
        return res
          .status(404)
          .json({
            error:
              'Professional profile not found'
          })
      }

      const days=
        Math.min(
          365,
          Math.max(
            1,
            Number(req.query.days)||30
          )
        )

      const analytics=
        await Analytics.summary(
          p.id,
          days
        )

      const trust=
        await meleoTrustForProfessional(
          p.id
        )

      const smartMatchDiagnostics=
        await smartMatchDiagnosticsForProfessional(
          p.id,
          trust
        )

      res.json({
        ...analytics,
        trust,
        smartMatchDiagnostics
      })
    }
  )
}
