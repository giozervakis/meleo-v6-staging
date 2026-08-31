import {useCallback,useEffect,useMemo,useState} from 'react'
import {api} from '../../../lib/api'
import {useTranslation} from 'react-i18next'
import './professional-billing.css'

type BillingPlan={
  id:string
  name:string
  price:number
  features:string[]
  recommended?:boolean
}

type BillingInvoice={
  id:string
  invoiceId?:string
  amount:number
  currency?:string
  status:string
  provider?:string
  hostedInvoiceUrl?:string
  createdAt:string
}

type BillingInfo={
  plan?:string
  price?:number
  status?:string
  stripeStatus?:string|null
  billingMode?:string|null
  currentPeriodEnd?:string|null
  cancelAtPeriodEnd?:boolean
  scheduledPlan?:string|null
  scheduledPlanEffectiveAt?:string|null
  portalAvailable?:boolean
  invoices?:BillingInvoice[]
}

type Props={
  professional:any
  token:string
  onRefresh:()=>Promise<any>|any
  setToast:(message:string)=>void
  cfg:any
}

function fallbackPlans(t:any):BillingPlan[]{
  return [
    {
      id:'basic',
      name:'BASIC',
      price:9.99,
      features:[
        t('proBilling.residue.features.publicProfile'),
        t('proBilling.residue.features.requests'),
        t('proBilling.residue.features.area'),
        t('proBilling.residue.features.stats')
      ]
    },
    {
      id:'premium',
      name:'PREMIUM',
      price:14.99,
      recommended:true,
      features:[
        t('proBilling.residue.features.allBasic'),
        t('proBilling.residue.features.priority'),
        t('proBilling.residue.features.recommendedBadge'),
        'Advanced profile analytics'
      ]
    }
  ]
}

function money(value:any){
  return new Intl.NumberFormat(
    'el-GR',
    {
      style:'currency',
      currency:'EUR'
    }
  ).format(Number(value||0))
}

function dateLabel(value?:string|null,locale='el-GR'){
  if(!value)return '—'

  const date=new Date(value)

  if(Number.isNaN(date.getTime())){
    return '—'
  }

  return date.toLocaleDateString(
    locale,
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  )
}

function statusLabel(value:string|null|undefined,t:any){
  const labels:Record<string,string>={
    active:t('proBilling.residue.status.active'),
    past_due:t('proBilling.residue.status.pastDue'),
    cancelled:t('proBilling.residue.status.cancelled'),
    canceled:t('proBilling.residue.status.cancelled'),
    pending:t('proBilling.residue.status.pending'),
    none:t('proBilling.residue.status.none'),
    incomplete:t('proBilling.residue.status.pending'),
    unpaid:t('proBilling.residue.status.unpaid'),
    trialing:t('proBilling.residue.status.trialing')
  }

  return labels[String(value||'')]||String(value||'—')
}

function invoiceStatus(value:string|undefined,t:any){
  const normalized=String(value||'').toLowerCase()

  if(normalized==='paid'){
    return t('proBilling.residue.invoice.paid')
  }

  if(
    normalized==='open' ||
    normalized==='pending'
  ){
    return t('proBilling.residue.invoice.pending')
  }

  if(
    normalized==='void' ||
    normalized==='cancelled' ||
    normalized==='canceled'
  ){
    return t('proBilling.residue.invoice.cancelled')
  }

  if(
    normalized==='failed' ||
    normalized==='unpaid'
  ){
    return t('proBilling.residue.invoice.failed')
  }

  return value||'—'
}

export default function ProfessionalBilling({
  professional,
  token,
  onRefresh,
  setToast,
  cfg
}:Props){

  const {t,i18n}=useTranslation()

  const [info,setInfo]=useState<BillingInfo|null>(null)
  const [busy,setBusy]=useState('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true)

    try{
      const data=await api(
        '/professional/subscription',
        {},
        token
      )

      setInfo(data||{})
      setError('')
    }
    catch(e:any){
      setError(
        e?.message ||
        t('proBilling.errors.load')
      )
    }
    finally{
      setLoading(false)
    }
  },[token])

  useEffect(()=>{
    load()
  },[load])

  const plans:BillingPlan[]=useMemo(
    ()=>{
      const configured=
        Array.isArray(cfg?.plans)
          ? cfg.plans
          : []

      return configured.length
        ? configured
        : fallbackPlans(t)
    },
    [cfg,t]
  )

  const current=
    String(
      info?.plan ||
      professional?.subscriptionPlan ||
      'basic'
    ).toLowerCase()

  const currentPrice=
    Number(
      info?.price ??
      professional?.subscriptionPrice ??
      0
    )

  const status=
    String(
      info?.status ||
      professional?.subscriptionStatus ||
      'none'
    )

  const cancelAtPeriodEnd=
    Boolean(
      info?.cancelAtPeriodEnd ??
      professional?.cancelAtPeriodEnd
    )

  const periodEnd=
    info?.currentPeriodEnd ||
    professional?.currentPeriodEnd ||
    null

  const invoices=
    Array.isArray(info?.invoices)
      ? info!.invoices!
      : []

  const currentPlan=
    plans.find(
      plan=>plan.id===current
    )

  const isPastDue=
    status==='past_due' ||
    info?.stripeStatus==='past_due'

  const isActive=
    status==='active'

  const billingMode=
    info?.billingMode ||
    professional?.billingMode ||
    null

  async function action(
    kind:'change'|'portal'|'cancel'|'resume'|'cancelDowngrade',
    plan?:string
  ){
    if(busy)return

    if(kind==='cancel'){
      const confirmed=window.confirm(
        t('proBilling.confirmCancel')
      )

      if(!confirmed)return
    }

    setError('')
    setBusy(
      kind+(plan||'')
    )

    try{

      if(kind==='change'){

        const result=await api(
          '/professional/subscription/checkout',
          {
            method:'POST',
            body:JSON.stringify({plan})
          },
          token
        )

        if(
          result?.mode==='stripe' &&
          result?.url
        ){
          window.location.href=result.url
          return
        }

        setToast(
          result?.scheduled
            ? t('proBilling.toast.changeScheduled',{plan:String(plan||'').toUpperCase()})
            : t('proBilling.toast.changed',{plan:String(plan||'').toUpperCase()})
        )
      }

      if(kind==='portal'){

        const result=await api(
          '/professional/subscription/portal',
          {
            method:'POST'
          },
          token
        )

        if(result?.url){
          window.location.href=result.url
          return
        }
      }

      if(kind==='cancel'){

        await api(
          '/professional/subscription/cancel',
          {
            method:'POST'
          },
          token
        )

        setToast(
          t('proBilling.toast.cancelScheduled')
        )
      }

      if(kind==='resume'){

        await api(
          '/professional/subscription/resume',
          {
            method:'POST'
          },
          token
        )

        setToast(
          t('proBilling.toast.resumed')
        )
      }

      if(kind==='cancelDowngrade'){

        await api(
          '/professional/subscription/downgrade/cancel',
          {
            method:'POST'
          },
          token
        )

        setToast(
          t('proBilling.toast.downgradeCancelled')
        )
      }

      await onRefresh()
      await load()
    }
    catch(e:any){
      setError(
        e?.message ||
        t('proBilling.errors.action')
      )
    }
    finally{
      setBusy('')
    }
  }

  return (
    <section className="pro-billing">

      <header className="pro-billing-hero">

        <div className="pro-billing-hero-copy">
          <span className="pro-billing-eyebrow">
            MELEO PROFESSIONAL MEMBERSHIP
          </span>

          <h2>
            {t('proBilling.hero.title')}
            <br/>
            <em>{t('proBilling.hero.emphasis')}</em>
          </h2>

          <p>
            {t('proBilling.hero.text')}
          </p>

          <div className="pro-billing-status-row">
            <span
              className={
                'pro-billing-status '+
                (
                  isPastDue
                    ? 'danger'
                    : isActive
                      ? 'active'
                      : 'neutral'
                )
              }
            >
              <i/>
              {statusLabel(status,t)}
            </span>

            {cancelAtPeriodEnd&&
              <span className="pro-billing-ending">
                {t('proBilling.hero.ends')} {dateLabel(periodEnd,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}
              </span>
            }
          </div>
        </div>

        <div className={'pro-billing-membership-card '+current}>

          <div className="pro-billing-card-top">
            <span>
              {t('proBilling.currentPlan')}
            </span>

            <b>
              {current.toUpperCase()}
            </b>
          </div>

          <div className="pro-billing-price">
            <strong>
              {money(currentPrice)}
            </strong>
            <span>
              {t('proBilling.perMonth')}
            </span>
          </div>

          <div className="pro-billing-renewal">
            <small>
              {cancelAtPeriodEnd
                ? t('proBilling.scheduledEnd')
                : t('proBilling.nextRenewal')}
            </small>

            <b>
              {dateLabel(periodEnd,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}
            </b>
          </div>

          <div className="pro-billing-mode">
            <span>
              {t('proBilling.billing')}
            </span>

            <b>
              {billingMode==='stripe'
                ? 'Stripe'
                : billingMode==='demo'
                  ? 'Demo'
                  : '—'}
            </b>
          </div>

        </div>

      </header>


      {isPastDue&&
        <div className="pro-billing-alert danger">
          <div>
            <span>!</span>
          </div>

          <section>
            <strong>
              {t('proBilling.pastDue.title')}
            </strong>

            <p>
              {t('proBilling.pastDue.text')}
            </p>
          </section>

          {info?.portalAvailable&&
            <button
              type="button"
              disabled={!!busy}
              onClick={()=>action('portal')}
            >
              {t('proBilling.pastDue.action')}
            </button>
          }
        </div>
      }


      {info?.scheduledPlan&&
        <div className="pro-billing-alert ending">
          <div>
            <span>↘</span>
          </div>

          <section>
            <strong>
              {t('proBilling.scheduledChange.title',{plan:String(info.scheduledPlan).toUpperCase()})}
            </strong>

            <p>
              {t('proBilling.residue.until')} {' '}
              <b>{dateLabel(info.scheduledPlanEffectiveAt,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}</b>
              {' '}{t('proBilling.scheduledChange.text',{current:current.toUpperCase(),plan:String(info.scheduledPlan).toUpperCase()})}
            </p>
          </section>

          <button
            type="button"
            disabled={!!busy}
            onClick={()=>action('cancelDowngrade')}
          >
            {busy==='cancelDowngrade'
              ? t('proBilling.scheduledChange.cancelling')
              : t('proBilling.scheduledChange.keepPremium')}
          </button>
        </div>
      }

      {cancelAtPeriodEnd&&
        <div className="pro-billing-alert ending">
          <div>
            <span>↻</span>
          </div>

          <section>
            <strong>
              {t('proBilling.cancellation.title')}
            </strong>

            <p>
              {t('proBilling.cancellation.text')}
              {' '}
              <b>{dateLabel(periodEnd,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}</b>.
            </p>
          </section>

          <button
            type="button"
            disabled={!!busy}
            onClick={()=>action('resume')}
          >
            {busy==='resume'
              ? t('proBilling.cancellation.resuming')
              : t('proBilling.cancellation.resume')}
          </button>
        </div>
      }


      {error&&
        <div className="pro-billing-error">
          {error}
        </div>
      }


      <section className="pro-billing-facts">

        <article>
          <span>{t('proBilling.facts.status')}</span>
          <strong>
            {statusLabel(status,t)}
          </strong>
          <small>
            {info?.stripeStatus
              ? `Stripe: ${info.stripeStatus}`
              : t('proBilling.facts.meleoStatus')}
          </small>
        </article>

        <article>
          <span>
            {cancelAtPeriodEnd
              ? t('proBilling.facts.end')
              : t('proBilling.facts.renewal')}
          </span>

          <strong>
            {dateLabel(periodEnd,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}
          </strong>

          <small>
            {t('proBilling.facts.monthly')}
          </small>
        </article>

        <article>
          <span>{t('proBilling.facts.billing')}</span>

          <strong>
            {billingMode==='stripe'
              ? 'Online'
              : billingMode==='demo'
                ? 'Demo'
                : '—'}
          </strong>

          <small>
            {billingMode==='stripe'
              ? t('proBilling.facts.stripeSafe')
              : billingMode==='demo'
                ? t('proBilling.facts.demoNoCharge')
                : t('proBilling.facts.noBillingData')}
          </small>
        </article>

      </section>


      <section className="pro-billing-section">

        <div className="pro-billing-section-heading">
          <div>
            <span>MEMBERSHIP</span>
            <h3>
              {t('proBilling.membership.title')}
            </h3>
          </div>

          <p>
            {t('proBilling.membership.text')}
          </p>
        </div>


        <div className="pro-billing-plans">

          {plans.map(plan=>{

            const selected=
              current===plan.id

            const upgrading=
              Number(plan.price)>currentPrice

            return (
              <article
                key={plan.id}
                className={
                  'pro-billing-plan '+
                  (plan.id==='premium'?'premium ':'')+
                  (selected?'selected ':'')
                }
              >

                <div className="pro-billing-plan-head">

                  <div>
                    <span>
                      {selected
                        ? t('proBilling.currentPlan')
                        : plan.recommended
                          ? t('proBilling.residue.recommended')
                          : 'MELEO PROFESSIONAL'}
                    </span>

                    <h4>
                      {plan.name}
                    </h4>
                  </div>

                  {selected&&
                    <i>
                      ✓
                    </i>
                  }

                </div>

                <div className="pro-billing-plan-price">
                  <strong>
                    {money(plan.price)}
                  </strong>
                  <span>
                    {t('proBilling.perMonthCompact')}
                  </span>
                </div>

                <div className="pro-billing-plan-features">
                  {(plan.features||[]).map(
                    feature=>
                      <div key={feature}>
                        <span>✓</span>
                        <p>{feature}</p>
                      </div>
                  )}
                </div>

                <button
                  type="button"
                  className={
                    plan.id==='premium'
                      ? 'primary'
                      : 'secondary'
                  }
                  disabled={
                    selected ||
                    !!busy ||
                    loading
                  }
                  onClick={()=>
                    action(
                      'change',
                      plan.id
                    )
                  }
                >
                  {selected
                    ? t('proBilling.plan.active')
                    : busy==='change'+plan.id
                      ? t('proBilling.plan.processing')
                      : upgrading
                        ? t('proBilling.plan.upgrade',{plan:plan.name})
                        : t('proBilling.plan.switch',{plan:plan.name})}
                </button>

              </article>
            )
          })}

        </div>

        {currentPlan&&
          <p className="pro-billing-proration-note">
            {t('proBilling.prorationNote')}
          </p>
        }

      </section>


      <section className="pro-billing-management">

        <div className="pro-billing-section-heading">
          <div>
            <span>BILLING</span>
            <h3>
              {t('proBilling.management.title')}
            </h3>
          </div>
        </div>

        <div className="pro-billing-management-grid">

          <article>
            <div className="pro-billing-management-icon">
              ◇
            </div>

            <div>
              <strong>
                {t('proBilling.management.paymentDetails')}
              </strong>

              <p>
                {t('proBilling.management.paymentText')}
              </p>
            </div>

            {info?.portalAvailable
              ? <button
                  type="button"
                  disabled={!!busy}
                  onClick={()=>action('portal')}
                >
                  {busy==='portal'
                    ? t('proBilling.management.opening')
                    : t('proBilling.management.openPortal')}
                </button>
              : <span className="pro-billing-unavailable">
                  {t('proBilling.management.unavailable')}
                </span>
            }
          </article>


          <article>
            <div className="pro-billing-management-icon">
              ↻
            </div>

            <div>
              <strong>
                {t('proBilling.management.subscriptionStatus')}
              </strong>

              <p>
                {cancelAtPeriodEnd
                  ? t('proBilling.management.cancelScheduled')
                  : t('proBilling.management.renewsNormally')}
              </p>
            </div>

            {cancelAtPeriodEnd
              ? <button
                  type="button"
                  className="dark"
                  disabled={!!busy}
                  onClick={()=>action('resume')}
                >
                  {busy==='resume'
                    ? t('proBilling.cancellation.resuming')
                    : t('proBilling.management.continue')}
                </button>
              : <button
                  type="button"
                  className="danger-link"
                  disabled={!!busy}
                  onClick={()=>action('cancel')}
                >
                  {busy==='cancel'
                    ? t('proBilling.management.cancelling')
                    : t('proBilling.management.cancelSubscription')}
                </button>
            }

          </article>

        </div>

      </section>


      <section className="pro-billing-invoices">

        <div className="pro-billing-section-heading">
          <div>
            <span>HISTORY</span>
            <h3>
              {t('proBilling.history.title')}
            </h3>
          </div>

          <p>
            {t('proBilling.history.text')}
          </p>
        </div>


        {loading
          ? <div className="pro-billing-empty">
              {t('proBilling.history.loading')}
            </div>

          : invoices.length

            ? <div className="pro-billing-invoice-table">

                <div className="pro-billing-invoice-head">
                  <span>{t('proBilling.history.date')}</span>
                  <span>{t('proBilling.history.amount')}</span>
                  <span>{t('proBilling.history.status')}</span>
                  <span/>
                </div>

                {invoices.map(invoice=>{

                  const paid=
                    String(invoice.status).toLowerCase()==='paid'

                  return (
                    <div
                      className="pro-billing-invoice"
                      key={invoice.id}
                    >
                      <span>
                        {dateLabel(invoice.createdAt,i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}
                      </span>

                      <strong>
                        {money(invoice.amount)}
                      </strong>

                      <span
                        className={
                          'invoice-status '+
                          (paid?'paid':'other')
                        }
                      >
                        {invoiceStatus(invoice.status,t)}
                      </span>

                      <span className="invoice-action">
                        {invoice.hostedInvoiceUrl
                          ? <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {t('proBilling.history.view')}
                            </a>
                          : '—'
                        }
                      </span>
                    </div>
                  )
                })}

              </div>

            : <div className="pro-billing-empty">
                <span>◇</span>
                <strong>
                  {t('proBilling.history.emptyTitle')}
                </strong>
                <p>
                  {t('proBilling.history.emptyText')}
                </p>
              </div>
        }

      </section>


      <footer className="pro-billing-footer-note">
        <span>i</span>

        <p>
          {t('proBilling.footerNote')}
        </p>
      </footer>

    </section>
  )
}
