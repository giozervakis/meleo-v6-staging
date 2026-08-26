export function registerAdminSubscriptionsRoutes({
  app,
  Professionals,
  many,
  getStripe,
  applyStripeSubscription,
  audit
}) {
  if (!app) throw new Error('registerAdminSubscriptionsRoutes: app required')
  if (!Professionals) throw new Error('registerAdminSubscriptionsRoutes: Professionals required')
  if (typeof many !== 'function') throw new Error('registerAdminSubscriptionsRoutes: many required')
  if (typeof getStripe !== 'function') throw new Error('registerAdminSubscriptionsRoutes: getStripe required')
  if (typeof applyStripeSubscription !== 'function') throw new Error('registerAdminSubscriptionsRoutes: applyStripeSubscription required')
  if (typeof audit !== 'function') throw new Error('registerAdminSubscriptionsRoutes: audit required')

  app.get('/api/admin/subscriptions', async (req, res) => {
    const subscriptions = await many(
      `SELECT
         s.id,
         s.professional_id "professionalId",
         s.stripe_subscription_id "stripeSubscriptionId",
         s.plan,
         s.price,
         s.status,
         s.stripe_status "stripeStatus",
         s.billing_mode "billingMode",
         s.started_at "startedAt",
         s.current_period_end "currentPeriodEnd",
         s.cancel_at_period_end "cancelAtPeriodEnd",
         s.updated_at "updatedAt",
         u.name "professionalName",
         u.email
       FROM subscriptions s
       JOIN professionals p
         ON p.id=s.professional_id
       JOIN users u
         ON u.id=p.user_id
       ORDER BY s.updated_at DESC
       LIMIT 200`
    )

    const payments = await many(
      `SELECT
         id,
         professional_id "professionalId",
         invoice_id "invoiceId",
         amount,
         currency,
         status,
         provider,
         hosted_invoice_url "hostedInvoiceUrl",
         created_at "createdAt"
       FROM payments
       ORDER BY created_at DESC
       LIMIT 200`
    )

    res.json({
      subscriptions: subscriptions.map(
        item => ({
          ...item,
          price: Number(item.price || 0)
        })
      ),
      payments: payments.map(
        item => ({
          ...item,
          amount: Number(item.amount || 0)
        })
      )
    })
  })

  app.post(
    '/api/admin/professionals/:id/sync-subscription',
    async (req, res) => {
      const professional =
        await Professionals.byId(
          req.params.id
        )

      if (!professional) {
        return res
          .status(404)
          .json({
            error: 'Not found'
          })
      }

      const stripe = getStripe()

      if (
        !professional.stripeSubscriptionId ||
        !stripe
      ) {
        return res
          .status(400)
          .json({
            error: 'Δεν υπάρχει Stripe subscription.'
          })
      }

      const subscription =
        await stripe.subscriptions.retrieve(
          professional.stripeSubscriptionId
        )

      const updated =
        await applyStripeSubscription(
          subscription
        )

      await audit(
        req.user.id,
        'admin.subscription.sync',
        {
          professionalId:
            professional.id
        }
      )

      res.json({
        professional: updated
      })
    }
  )
}
