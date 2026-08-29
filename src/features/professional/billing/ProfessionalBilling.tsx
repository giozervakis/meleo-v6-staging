import {useCallback,useEffect,useMemo,useState} from 'react'
import {api} from '../../../lib/api'
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

const FALLBACK_PLANS:BillingPlan[]=[
  {
    id:'basic',
    name:'BASIC',
    price:9.99,
    features:[
      'Δημόσιο επαγγελματικό προφίλ',
      'Αιτήματα και διαχείριση κρατήσεων',
      'Περιοχή & ακτίνα εξυπηρέτησης',
      'Βασικά στατιστικά'
    ]
  },
  {
    id:'premium',
    name:'PREMIUM',
    price:14.99,
    recommended:true,
    features:[
      'Όλα τα BASIC',
      'Προτεραιότητα στην κατάταξη αποτελεσμάτων',
      'Σήμανση «Προτεινόμενος»',
      'Advanced profile analytics'
    ]
  }
]

function money(value:any){
  return new Intl.NumberFormat(
    'el-GR',
    {
      style:'currency',
      currency:'EUR'
    }
  ).format(Number(value||0))
}

function dateLabel(value?:string|null){
  if(!value)return '—'

  const date=new Date(value)

  if(Number.isNaN(date.getTime())){
    return '—'
  }

  return date.toLocaleDateString(
    'el-GR',
    {
      day:'2-digit',
      month:'short',
      year:'numeric'
    }
  )
}

function statusLabel(value?:string|null){
  const labels:Record<string,string>={
    active:'Ενεργή',
    past_due:'Εκκρεμεί πληρωμή',
    cancelled:'Ακυρωμένη',
    canceled:'Ακυρωμένη',
    pending:'Σε εκκρεμότητα',
    none:'Χωρίς συνδρομή',
    incomplete:'Σε εκκρεμότητα',
    unpaid:'Απαιτείται πληρωμή',
    trialing:'Δοκιμαστική'
  }

  return labels[String(value||'')]||String(value||'—')
}

function invoiceStatus(value?:string){
  const normalized=String(value||'').toLowerCase()

  if(normalized==='paid'){
    return 'Πληρωμένο'
  }

  if(
    normalized==='open' ||
    normalized==='pending'
  ){
    return 'Σε εκκρεμότητα'
  }

  if(
    normalized==='void' ||
    normalized==='cancelled' ||
    normalized==='canceled'
  ){
    return 'Ακυρωμένο'
  }

  if(
    normalized==='failed' ||
    normalized==='unpaid'
  ){
    return 'Απέτυχε'
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
        'Δεν ήταν δυνατή η φόρτωση των στοιχείων χρέωσης.'
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
        : FALLBACK_PLANS
    },
    [cfg]
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
        'Να προγραμματιστεί η ακύρωση της συνδρομής στο τέλος της τρέχουσας περιόδου;'
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
            ? `Η αλλαγή σε ${String(plan||'').toUpperCase()} προγραμματίστηκε για την επόμενη ανανέωση.`
            : `Το πακέτο ενημερώθηκε σε ${String(plan||'').toUpperCase()}.`
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
          'Η ακύρωση της συνδρομής προγραμματίστηκε.'
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
          'Η συνδρομή συνεχίζεται κανονικά.'
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
          'Η προγραμματισμένη αλλαγή ακυρώθηκε. Παραμένεις PREMIUM.'
        )
      }

      await onRefresh()
      await load()
    }
    catch(e:any){
      setError(
        e?.message ||
        'Η ενέργεια δεν ολοκληρώθηκε.'
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
            Η συνδρομή σου,
            <br/>
            <em>χωρίς ψιλά γράμματα.</em>
          </h2>

          <p>
            Διαχειρίσου το πακέτο, τη χρέωση και το
            ιστορικό πληρωμών σου από ένα σημείο.
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
              {statusLabel(status)}
            </span>

            {cancelAtPeriodEnd&&
              <span className="pro-billing-ending">
                Λήγει {dateLabel(periodEnd)}
              </span>
            }
          </div>
        </div>

        <div className={'pro-billing-membership-card '+current}>

          <div className="pro-billing-card-top">
            <span>
              ΤΡΕΧΟΝ ΠΑΚΕΤΟ
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
              / μήνα
            </span>
          </div>

          <div className="pro-billing-renewal">
            <small>
              {cancelAtPeriodEnd
                ? 'ΠΡΟΓΡΑΜΜΑΤΙΣΜΕΝΗ ΛΗΞΗ'
                : 'ΕΠΟΜΕΝΗ ΑΝΑΝΕΩΣΗ'}
            </small>

            <b>
              {dateLabel(periodEnd)}
            </b>
          </div>

          <div className="pro-billing-mode">
            <span>
              Χρέωση
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
              Υπάρχει εκκρεμότητα πληρωμής
            </strong>

            <p>
              Η τελευταία χρέωση δεν ολοκληρώθηκε.
              Ενημέρωσε τα στοιχεία πληρωμής σου για
              να διατηρηθεί ομαλά η συνδρομή.
            </p>
          </section>

          {info?.portalAvailable&&
            <button
              type="button"
              disabled={!!busy}
              onClick={()=>action('portal')}
            >
              Διαχείριση πληρωμής
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
              Αλλαγή σε {String(info.scheduledPlan).toUpperCase()} στην επόμενη ανανέωση
            </strong>

            <p>
              Μέχρι {' '}
              <b>{dateLabel(info.scheduledPlanEffectiveAt)}</b>
              {' '}διατηρείς όλα τα προνόμια του {current.toUpperCase()} που έχεις ήδη πληρώσει.
              Από τότε θα ενεργοποιηθεί το {String(info.scheduledPlan).toUpperCase()}.
            </p>
          </section>

          <button
            type="button"
            disabled={!!busy}
            onClick={()=>action('cancelDowngrade')}
          >
            {busy==='cancelDowngrade'
              ? 'Ακύρωση αλλαγής…'
              : 'Παραμονή στο PREMIUM'}
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
              Η συνδρομή έχει προγραμματιστεί για ακύρωση
            </strong>

            <p>
              Η πρόσβαση παραμένει σύμφωνα με την
              τρέχουσα περίοδο συνδρομής έως
              {' '}
              <b>{dateLabel(periodEnd)}</b>.
            </p>
          </section>

          <button
            type="button"
            disabled={!!busy}
            onClick={()=>action('resume')}
          >
            {busy==='resume'
              ? 'Επαναφορά…'
              : 'Συνέχιση συνδρομής'}
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
          <span>ΚΑΤΑΣΤΑΣΗ</span>
          <strong>
            {statusLabel(status)}
          </strong>
          <small>
            {info?.stripeStatus
              ? `Stripe: ${info.stripeStatus}`
              : 'Κατάσταση MELEO'}
          </small>
        </article>

        <article>
          <span>
            {cancelAtPeriodEnd
              ? 'ΛΗΞΗ'
              : 'ΑΝΑΝΕΩΣΗ'}
          </span>

          <strong>
            {dateLabel(periodEnd)}
          </strong>

          <small>
            Μηνιαία συνδρομή
          </small>
        </article>

        <article>
          <span>ΧΡΕΩΣΗ</span>

          <strong>
            {billingMode==='stripe'
              ? 'Online'
              : billingMode==='demo'
                ? 'Demo'
                : '—'}
          </strong>

          <small>
            {billingMode==='stripe'
              ? 'Ασφαλής διαχείριση μέσω Stripe'
              : billingMode==='demo'
                ? 'Δεν πραγματοποιείται πραγματική χρέωση'
                : 'Δεν υπάρχουν στοιχεία χρέωσης'}
          </small>
        </article>

      </section>


      <section className="pro-billing-section">

        <div className="pro-billing-section-heading">
          <div>
            <span>MEMBERSHIP</span>
            <h3>
              Επίλεξε το πακέτο που σου ταιριάζει
            </h3>
          </div>

          <p>
            Μπορείς να αλλάξεις πακέτο χωρίς να
            δημιουργήσεις νέο επαγγελματικό λογαριασμό.
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
                        ? 'ΤΡΕΧΟΝ ΠΑΚΕΤΟ'
                        : plan.recommended
                          ? 'ΠΡΟΤΕΙΝΟΜΕΝΟ'
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
                    /μήνα
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
                    ? 'Ενεργό πακέτο'
                    : busy==='change'+plan.id
                      ? 'Επεξεργασία…'
                      : upgrading
                        ? `Αναβάθμιση σε ${plan.name}`
                        : `Μετάβαση σε ${plan.name}`}
                </button>

              </article>
            )
          })}

        </div>

        {currentPlan&&
          <p className="pro-billing-proration-note">
            Οι αλλαγές ενεργής Stripe συνδρομής
            υπολογίζονται αναλογικά από τον πάροχο
            πληρωμών.
          </p>
        }

      </section>


      <section className="pro-billing-management">

        <div className="pro-billing-section-heading">
          <div>
            <span>BILLING</span>
            <h3>
              Πληρωμές & διαχείριση
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
                Στοιχεία πληρωμής
              </strong>

              <p>
                Διαχειρίσου τον τρόπο πληρωμής και
                τα στοιχεία χρέωσης από το ασφαλές
                billing portal.
              </p>
            </div>

            {info?.portalAvailable
              ? <button
                  type="button"
                  disabled={!!busy}
                  onClick={()=>action('portal')}
                >
                  {busy==='portal'
                    ? 'Άνοιγμα…'
                    : 'Άνοιγμα billing portal'}
                </button>
              : <span className="pro-billing-unavailable">
                  Μη διαθέσιμο
                </span>
            }
          </article>


          <article>
            <div className="pro-billing-management-icon">
              ↻
            </div>

            <div>
              <strong>
                Κατάσταση συνδρομής
              </strong>

              <p>
                {cancelAtPeriodEnd
                  ? 'Η ακύρωση έχει ήδη προγραμματιστεί.'
                  : 'Η συνδρομή ανανεώνεται σύμφωνα με την ενεργή περίοδο χρέωσης.'}
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
                    ? 'Επαναφορά…'
                    : 'Συνέχιση'}
                </button>
              : <button
                  type="button"
                  className="danger-link"
                  disabled={!!busy}
                  onClick={()=>action('cancel')}
                >
                  {busy==='cancel'
                    ? 'Ακύρωση…'
                    : 'Ακύρωση συνδρομής'}
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
              Ιστορικό χρεώσεων
            </h3>
          </div>

          <p>
            Οι πιο πρόσφατες καταγεγραμμένες
            συναλλαγές της συνδρομής σου.
          </p>
        </div>


        {loading
          ? <div className="pro-billing-empty">
              Φόρτωση ιστορικού…
            </div>

          : invoices.length

            ? <div className="pro-billing-invoice-table">

                <div className="pro-billing-invoice-head">
                  <span>Ημερομηνία</span>
                  <span>Ποσό</span>
                  <span>Κατάσταση</span>
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
                        {dateLabel(invoice.createdAt)}
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
                        {invoiceStatus(invoice.status)}
                      </span>

                      <span className="invoice-action">
                        {invoice.hostedInvoiceUrl
                          ? <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Προβολή ↗
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
                  Δεν υπάρχει ακόμη ιστορικό χρεώσεων
                </strong>
                <p>
                  Όταν καταγραφεί συναλλαγή συνδρομής,
                  θα εμφανιστεί εδώ.
                </p>
              </div>
        }

      </section>


      <footer className="pro-billing-footer-note">
        <span>i</span>

        <p>
          Η MELEO δεν αποθηκεύει στοιχεία κάρτας.
          Η διαχείριση πραγματικών ηλεκτρονικών
          πληρωμών πραγματοποιείται μέσω του
          παρόχου πληρωμών. Η MELEO δεν κρατά
          προμήθεια από τις επισκέψεις σου.
        </p>
      </footer>

    </section>
  )
}