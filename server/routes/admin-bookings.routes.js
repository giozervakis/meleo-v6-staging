export function registerAdminBookingsRoutes({
  app,
  Bookings
}) {
  if (!app) {
    throw new Error(
      'registerAdminBookingsRoutes: app is required'
    )
  }

  if (
    !Bookings ||
    typeof Bookings.listForUser !== 'function'
  ) {
    throw new Error(
      'registerAdminBookingsRoutes: Bookings.listForUser is required'
    )
  }

  app.get(
    '/api/admin/bookings',
    async (req,res) =>
      res.json(
        await Bookings.listForUser(
          {
            id: req.user.id,
            role: 'admin'
          },
          req.query
        )
      )
  )
}
