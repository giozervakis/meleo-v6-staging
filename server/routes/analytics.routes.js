export function registerAnalyticsRoutes({
  app,
  limits,
  str,
  Analytics,
  fingerprint,
  sha256
}) {
  app.post(
    '/api/analytics/professional-event',
    limits.analytics,
    async (req,res) => {
      const pid =
        str(
          req.body.professionalId,
          80
        )

      const type =
        str(
          req.body.type,
          40
        )

      const sid =
        str(
          req.body.sessionId,
          100
        )

      if (
        ![
          'impression',
          'profile_view',
          'phone_click'
        ].includes(type) ||
        !pid
      ) {
        return res
          .status(400)
          .json({
            error:
              'Invalid event'
          })
      }

      const windowMin =
        type === 'impression'
          ? 60
          : type === 'profile_view'
            ? 30
            : 5

      const fp =
        fingerprint(
          pid,
          type,
          sid,
          sha256(
            req.ip || ''
          ),
          new Date()
            .toISOString()
            .slice(0,13)
        )

      const accepted =
        await Analytics.event(
          pid,
          type,
          fp,
          windowMin
        )

      res.json({
        ok: true,
        accepted
      })
    }
  )
}
