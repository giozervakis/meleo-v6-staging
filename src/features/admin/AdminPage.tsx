import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
import { APP_VERSION } from '../../version'

function money(v: number) {
  return `${Number(v || 0).toFixed(2).replace('.', ',')}€`
}

function statusLabel(s:string){ return ({pending:'Σε αναμονή',clarification:'Χρειάζονται διευκρινίσεις',quoted:'Πρόταση κόστους',accepted:'Επιβεβαιωμένη',completed:'Ολοκληρώθηκε',cancelled:'Ακυρώθηκε'} as any)[s]||s }
function professionalLifecycleLabel(s:string){return ({approved:'Verified',pending_verification:'Pending Verification',verification_rejected:'Verification Rejected',awaiting_subscription:'Αναμονή συνδρομής',profile_incomplete:'Ελλιπές προφίλ',verification_required:'Αναμονή υποβολής verification',deletion_pending:'Διαγραφή σε αναμονή'} as any)[s]||'—'}
function Stat({label,value,note}:any){return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
function DashboardHead({eyebrow,title,subtitle}:any){return <div className="dashboard-head"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>}
function SectionTitle({over,title,subtitle}:any){return <div className="section-title"><div className="eyebrow">{over}</div><h2>{title}</h2><p>{subtitle}</p></div>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}

function Euro({value}:any){return <>{Number(value||0).toLocaleString('el-GR',{style:'currency',currency:'EUR',minimumFractionDigits:2})}</>}
function MiniBars({items,labelKey='date',valueKey='count'}:any){const max=Math.max(1,...items.map((x:any)=>Number(x[valueKey]||0)));return <div className="mini-bars">{items.map((x:any,i:number)=><div className="mini-bar" key={i} title={`${x[labelKey]} · ${x[valueKey]}`}><i style={{height:`${Math.max(7,Number(x[valueKey]||0)/max*100)}%`}}></i><small>{i%3===0?String(x[labelKey]).slice(5):''}</small></div>)}</div>}
function AdminSubscriptions({token,setToast}:any){
 const {t,i18n}=useTranslation()
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState('')
 async function refresh(){try{setData(await api('/admin/subscriptions',{},token))}catch(e:any){setToast(e.message||t('adminSubscriptions.toast.loadError'))}}
 useEffect(()=>{refresh()},[])
 async function sync(professionalId:string){setBusy(professionalId);try{await api('/admin/professionals/'+professionalId+'/sync-subscription',{method:'POST'},token);await refresh();setToast(t('adminSubscriptions.toast.synced'))}catch(e:any){setToast(e.message||t('adminSubscriptions.toast.syncFailed'))}finally{setBusy('')}}
 if(!data)return <div className="panel">{t('adminSubscriptions.loading')}</div>
 const subs=data.subscriptions||[],pays=data.payments||[]
 const label:any={active:t('adminSubscriptions.status.active'),past_due:t('adminSubscriptions.status.pastDue'),cancelled:t('adminSubscriptions.status.cancelled'),none:t('adminSubscriptions.status.none')}
 return <>
  <div className="panel admin-table-panel"><div className="table-toolbar"><div><h3>{t('adminSubscriptions.subscriptions.title')}</h3><span>{t('adminSubscriptions.subscriptions.subtitle')}</span></div><button className="btn ghost small" onClick={refresh}>{t('adminSubscriptions.actions.refresh')}</button></div>
   {subs.length?<table className="admin-table"><thead><tr><th>{t('adminSubscriptions.subscriptions.columns.professional')}</th><th>{t('adminSubscriptions.subscriptions.columns.plan')}</th><th>{t('adminSubscriptions.subscriptions.columns.status')}</th><th>{t('adminSubscriptions.subscriptions.columns.nextRenewal')}</th><th>{t('adminSubscriptions.subscriptions.columns.method')}</th><th/></tr></thead>
    <tbody>{subs.map((s:any)=><tr key={s.id}>
     <td><b>{s.professionalName||'—'}</b><span className="muted small-note">{s.email}</span></td>
     <td>{String(s.plan||'—').toUpperCase()} · {money(s.price||0)}</td>
     <td><span className={s.status==='active'?'ok-tag':(s.status==='past_due'?'warn-tag':'muted')}>{label[s.status]||s.status}{s.cancelAtPeriodEnd?t('adminSubscriptions.status.endsAtPeriodEnd'):''}</span></td>
     <td>{s.currentPeriodEnd?new Date(s.currentPeriodEnd).toLocaleDateString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR'):<span className="muted">—</span>}</td>
     <td>{s.billingMode==='stripe'?'Stripe':(s.billingMode||'—')}</td>
     <td>{s.billingMode==='stripe'?<button className="btn ghost small" disabled={busy===s.professionalId} onClick={()=>sync(s.professionalId)}>{busy===s.professionalId?'…':'Sync'}</button>:null}</td>
    </tr>)}</tbody></table>:<p className="muted">{t('adminSubscriptions.subscriptions.empty')}</p>}
  </div>
  <div className="panel admin-table-panel"><div className="panel-heading"><h3>{t('adminSubscriptions.payments.title')}</h3><span>{t('adminSubscriptions.payments.subtitle')}</span></div>
   {pays.length?<table className="admin-table"><thead><tr><th>{t('adminSubscriptions.payments.columns.date')}</th><th>{t('adminSubscriptions.payments.columns.amount')}</th><th>{t('adminSubscriptions.payments.columns.status')}</th><th>{t('adminSubscriptions.payments.columns.receipt')}</th></tr></thead>
    <tbody>{pays.map((x:any)=><tr key={x.id}>
     <td>{x.createdAt?new Date(x.createdAt).toLocaleString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR'):'—'}</td>
     <td>{money(x.amount||0)}</td>
     <td><span className={x.status==='paid'?'ok-tag':'warn-tag'}>{x.status==='paid'?t('adminSubscriptions.payments.paid'):t('adminSubscriptions.payments.failed')}</span></td>
     <td>{x.hostedInvoiceUrl?<a className="inline-link" href={x.hostedInvoiceUrl} target="_blank" rel="noreferrer">{t('adminSubscriptions.payments.view')}</a>:<span className="muted">—</span>}</td>
    </tr>)}</tbody></table>:<p className="muted">{t('adminSubscriptions.payments.empty')}</p>}
  </div>
 </>
}
function Admin({token,setToast}:any){
 const {t,i18n}=useTranslation()
 const [stats,setStats]=useState<any>(null),
      [command,setCommand]=useState<any>(null),
      [vers,setVers]=useState<any[]>([]),
      [members,setMembers]=useState<any[]>([]),
      [bookings,setBookings]=useState<any[]>([]),
      [insights,setInsights]=useState<any>(null),
      [auditRows,setAuditRows]=useState<any[]>([])
 const [tab,setTab]=useState('overview'),[query,setQuery]=useState(''),[roleFilter,setRoleFilter]=useState('all'),[planFilter,setPlanFilter]=useState('all'),[statusFilter,setStatusFilter]=useState('all'),[busy,setBusy]=useState('')
 async function refresh(){
  try{

    const [
      statsData,
      commandData,
      verificationData,
      memberData,
      bookingData,
      insightData,
      auditData
    ]=await Promise.all([

      api('/admin/stats',{},token),

      api('/admin/command-center',{},token),

      api(
        '/admin/verifications?limit=100',
        {},
        token
      ),

      api(
        '/admin/members?limit=100',
        {},
        token
      ),

      api(
        '/admin/bookings?limit=100',
        {},
        token
      ),

      api('/admin/insights',{},token),

      api(
        '/admin/audit?limit=200',
        {},
        token
      )

    ])

    setStats(statsData)

    setCommand(commandData)

    setVers(
      Array.isArray(verificationData)
        ? verificationData
        : verificationData.items||[]
    )

    setMembers(
      Array.isArray(memberData)
        ? memberData
        : memberData.items||[]
    )

    setBookings(
      Array.isArray(bookingData)
        ? bookingData
        : bookingData.items||[]
    )

    setInsights(insightData)

    setAuditRows(
      Array.isArray(auditData)
        ? auditData
        : auditData.items||[]
    )

  }
  catch(e:any){

    console.error(
      'Admin Command Center load failed',
      e
    )

    setToast(
      e.message||
      t('adminCommand.toast.loadFailed')
    )

  }
}
 
 useEffect(()=>{refresh()},[])
 async function decide(id:string,status:string){const approved=status==='approved';const raw=window.prompt(approved?t('adminCommand.verification.approveNote'):t('adminCommand.verification.rejectReason')) ;if(raw===null)return;const note=raw.trim();if(!approved&&!note){setToast(t('adminCommand.verification.rejectRequired'));return}await api('/admin/verifications/'+id,{method:'PATCH',body:JSON.stringify({status,adminNote:note})},token);await refresh();setToast(approved?t('adminCommand.verification.approvedToast'):t('adminCommand.verification.rejectedToast'))}
 async function memberAction(m:any,action:string){
   const destructive=['suspend','unverify'].includes(action)
   const label:any={suspend:t('adminCommand.memberActions.suspend'),reactivate:t('adminCommand.memberActions.reactivate'),verify:t('adminCommand.memberActions.verify'),unverify:t('adminCommand.memberActions.unverify'),feature:t('adminCommand.memberActions.feature'),unfeature:t('adminCommand.memberActions.unfeature')}
   if(!window.confirm(t('adminCommand.memberActions.confirm',{action:label[action]||action,name:m.name})))return
   const reason=(destructive||action==='verify')?(window.prompt(t('adminCommand.memberActions.reason'))||''):''
   setBusy(m.id+action)
   try{await api('/admin/members/'+m.id+'/action',{method:'PATCH',body:JSON.stringify({action,reason})},token);await refresh();setToast(t('adminCommand.memberActions.completed'))}catch(e:any){setToast(e.message||t('adminCommand.memberActions.failed'))}finally{setBusy('')}
 }
 if(!stats||!insights||!command){
  return (
    <div className="splash">
      Loading MELEO Command Center…
    </div>
  )
}
 const filteredMembers=members.filter(m=>(roleFilter==='all'||m.role===roleFilter)&&(planFilter==='all'||m.subscriptionPlan===planFilter)&&(statusFilter==='all'||m.accountStatus===statusFilter)&&(!query||`${m.name} ${m.email} ${m.specialty} ${m.city}`.toLowerCase().includes(query.toLowerCase())))
 const mp=stats.marketplace||{}
 const executive=
  command.executive||{}

const health=
  command.marketplaceHealth||{}

const operations=
  command.operations||{}

const growth=
  command.growth||{}

const subscriptionHealth=
  command.subscriptionHealth||{}

const commandAlerts=
  command.alerts||[]

const commandTrends=
  command.trends||{}

const marketplaceCommand=
  command.marketplace||{}

const criticalAlerts=
  commandAlerts.filter(
    (x:any)=>x.severity==='critical'
  ).length

const warningAlerts=
  commandAlerts.filter(
    (x:any)=>x.severity==='warning'
  ).length

const totalAttention=
  Number(operations.pendingVerifications||0)+
  Number(operations.pastDueSubscriptions||0)+
  Number(operations.failedPayments||0)+
  Number(operations.suspendedAccounts||0)+
  Number(operations.openReports||0)+
  Number(operations.deletionPending||0)

const platformOperational=
  criticalAlerts===0
 return <section className="admin-page admin-control"><div className="container"><DashboardHead eyebrow={`MELEO v${APP_VERSION} · FOUNDER & OPERATIONS`} title="Admin Control Center" subtitle={t('adminCommand.header.subtitle')}/>
 <div className="admin-commandbar"><div><span className="live-dot"></span><b>Operations live</b><small>{t('adminCommand.commandBar.lastRefresh')} {new Date().toLocaleTimeString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR',{hour:'2-digit',minute:'2-digit'})}</small></div><button className="btn ghost small" onClick={refresh}>{t('adminCommand.commandBar.refresh')}</button></div>
 <div className="admin-kpi-strip"><div><span>{t('adminCommand.kpi.totalMembers')}</span><strong>{stats.accounts.total}</strong><small>+{stats.accounts.new30} / 30 {t('adminCommand.kpi.days')} · {mp.active30||0} {t('adminCommand.kpi.active')}</small></div><div><span>{t('adminCommand.kpi.professionals')}</span><strong>{stats.professionals.total}</strong><small>{stats.professionals.verified} verified · {stats.professionals.pendingVerification} pending</small></div><div><span>PREMIUM SHARE</span><strong>{mp.premiumShare||0}%</strong><small>{stats.professionals.premium} Premium · {stats.professionals.basic} Basic</small></div><div className="revenue-kpi"><span>{t('adminCommand.kpi.subscriptionMrr')}</span><strong><Euro value={stats.revenue.subscriptionMrr}/></strong><small>Collected this month <Euro value={stats.revenue.collectedRevenue}/></small></div></div>
 <div className="admin-tabs"><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}>{t('adminCommand.tabs.overview')}</button><button className={tab==='insights'?'active':''} onClick={()=>setTab('insights')}>Insights</button><button className={tab==='members'?'active':''} onClick={()=>setTab('members')}>{t('adminCommand.tabs.members')} <b>{members.length}</b></button><button className={tab==='bookings'?'active':''} onClick={()=>setTab('bookings')}>{t('adminCommand.tabs.bookings')} <b>{bookings.length}</b></button><button className={tab==='revenue'?'active':''} onClick={()=>setTab('revenue')}>{t('adminCommand.tabs.revenue')}</button><button className={tab==='subs'?'active':''} onClick={()=>setTab('subs')}>{t('adminCommand.tabs.subscriptions')}</button><button className={tab==='verification'?'active':''} onClick={()=>setTab('verification')}>Verification <b>{stats.professionals.pendingVerification}</b></button><button className={tab==='support'?'active':''} onClick={()=>setTab('support')}>Support</button><button className={tab==='smart'?'active':''} onClick={()=>setTab('smart')}>🧠 Smart Requests</button><button className={tab==='audit'?'active':''} onClick={()=>setTab('audit')}>Audit Log</button></div>
 {tab==='overview'&&<>

  <section className="admin-executive-hero">

    <div className="admin-executive-main">

      <div>
        <small>{t('adminOverview.hero.kicker')}</small>

        <h2>
          {t('adminOverview.hero.title')}
        </h2>

        <p>
          {t('adminOverview.hero.subtitle')}
        </p>
      </div>

      <div
        className={
          'admin-platform-status '+
          (platformOperational
            ? 'operational'
            : 'attention'
          )
        }
      >
        <span/>

        <div>
          <small>
            {t('adminOverview.hero.platformStatus')}
          </small>

          <b>
            {platformOperational
              ? t('adminOverview.hero.operational')
              : t('adminOverview.hero.needsAttention')
            }
          </b>
        </div>
      </div>

    </div>


    <div className="admin-executive-kpis">

      <div className="admin-exec-kpi revenue">
        <span>MRR</span>

        <strong>
          <Euro value={executive.mrr}/>
        </strong>

        <small>
          ARR <Euro value={executive.arr}/>
        </small>
      </div>


      <div className="admin-exec-kpi">
        <span>ACTIVE PROS</span>

        <strong>
          {executive.activeProfessionals||0}
        </strong>

        <small>
          {executive.activeSubscriptions||0}
          {' '}{t('adminOverview.kpi.activeSubscriptions')}
        </small>
      </div>


      <div className="admin-exec-kpi">
        <span>BOOKINGS · 30D</span>

        <strong>
          {executive.bookings30||0}
        </strong>

        <small>
          {growth.bookingsGrowth>=0?'+':''}
          {growth.bookingsGrowth||0}% {t('adminOverview.kpi.vsPrevious30d')}
        </small>
      </div>


      <div className="admin-exec-kpi">
        <span>PATIENTS</span>

        <strong>
          {executive.patients||0}
        </strong>

        <small>
          {growth.usersGrowth>=0?'+':''}
          {growth.usersGrowth||0}% growth
        </small>
      </div>


      <div className="admin-exec-kpi">
        <span>GMV · 30D</span>

        <strong>
          <Euro value={executive.gmv30}/>
        </strong>

        <small>
          {t('adminOverview.kpi.marketplaceVolume')}
        </small>
      </div>


      <div className="admin-exec-kpi">
        <span>PREMIUM SHARE</span>

        <strong>
          {subscriptionHealth.premiumShare||0}%
        </strong>

        <small>
          {subscriptionHealth.premium||0}
          {' '}Premium ·{' '}
          {subscriptionHealth.basic||0}
          {' '}Basic
        </small>
      </div>

    </div>

  </section>


  <section className="admin-command-attention">

    <div className="admin-command-section-head">

      <div>
        <small>OPERATIONS</small>

        <h3>
          {t('adminOverview.attention.title')}
        </h3>
      </div>

      <span>
        {totalAttention} {t('adminOverview.attention.total')}
      </span>

    </div>


    {commandAlerts.length
      ? <div className="admin-alert-grid">

          {commandAlerts.map((alert:any)=>

            <article
              key={alert.key}
              className={
                'admin-command-alert '+
                alert.severity
              }
            >

              <div className="admin-command-alert-count">
                {alert.count}
              </div>

              <div>
                <b>
                  {alert.title}
                </b>

                <p>
                  {alert.text}
                </p>
              </div>

              <span>
                {alert.severity==='critical'
                  ? '!'
                  : alert.severity==='warning'
                    ? '⚠'
                    : 'i'
                }
              </span>

            </article>

          )}

        </div>

      : <div className="admin-all-clear">

          <span>
            ✓
          </span>

          <div>
            <b>
              {t('adminOverview.attention.clearTitle')}
            </b>

            <p>
              {t('adminOverview.attention.clearText')}
            </p>
          </div>

        </div>
    }

  </section>


  <div className="admin-command-health-grid">


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminMarketplaceHealth.kicker')}</small>

          <h3>
            {t('adminMarketplaceHealth.title')}
          </h3>
        </div>

      </div>


      <div className="admin-health-metrics">

        <div>
          <span>{t('adminMarketplaceHealth.metrics.completion')}</span>

          <strong>
            {health.bookingCompletionRate||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.bookingCompletionRate||0
                  )}%`
              }}
            />
          </i>
        </div>


        <div>
          <span>{t('adminMarketplaceHealth.metrics.fulfillment')}</span>

          <strong>
            {health.requestFulfillmentRate||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.requestFulfillmentRate||0
                  )}%`
              }}
            />
          </i>
        </div>


        <div>
          <span>{t('adminMarketplaceHealth.metrics.repeatCare')}</span>

          <strong>
            {health.repeatCareRate||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.repeatCareRate||0
                  )}%`
              }}
            />
          </i>
        </div>


        <div>
          <span>{t('adminMarketplaceHealth.metrics.trustCoverage')}</span>

          <strong>
            {health.trustCoverage||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.trustCoverage||0
                  )}%`
              }}
            />
          </i>
        </div>


        <div>
          <span>{t('adminMarketplaceHealth.metrics.patientActivation')}</span>

          <strong>
            {health.patientActivationRate||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.patientActivationRate||0
                  )}%`
              }}
            />
          </i>
        </div>


        <div>
          <span>{t('adminMarketplaceHealth.metrics.reviewCoverage')}</span>

          <strong>
            {health.reviewCoverage||0}%
          </strong>

          <i>
            <b
              style={{
                width:
                  `${Math.min(
                    100,
                    health.reviewCoverage||0
                  )}%`
              }}
            />
          </i>
        </div>

      </div>

    </section>


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminSubscriptionHealth.kicker')}</small>

          <h3>
            {t('adminSubscriptionHealth.title')}
          </h3>
        </div>

      </div>


      <div className="admin-subscription-command">

        <div className="admin-sub-ring">

          <strong>
            {subscriptionHealth.active||0}
          </strong>

          <span>
            {t('adminSubscriptionHealth.active')}
          </span>

        </div>


        <div className="admin-subscription-lines">

          <div>
            <span>{t('adminSubscriptionHealth.basic')}</span>
            <b>{subscriptionHealth.basic||0}</b>
          </div>

          <div>
            <span>{t('adminSubscriptionHealth.premium')}</span>
            <b>{subscriptionHealth.premium||0}</b>
          </div>

          <div>
            <span>{t('adminSubscriptionHealth.pastDue')}</span>
            <b>{subscriptionHealth.pastDue||0}</b>
          </div>

          <div>
            <span>{t('adminSubscriptionHealth.cancelled')}</span>
            <b>{subscriptionHealth.cancelled||0}</b>
          </div>

        </div>

      </div>

    </section>

  </div>


  <div className="admin-command-trends">


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminGrowth.registrationKicker')}</small>

          <h3>
            {t('adminGrowth.newRegistrations')}
          </h3>
        </div>

        <strong
          className={
            growth.usersGrowth>=0
              ? 'positive-growth'
              : 'negative-growth'
          }
        >
          {growth.usersGrowth>=0?'+':''}
          {growth.usersGrowth||0}%
        </strong>

      </div>

      <MiniBars
        items={commandTrends.registrations30||[]}
      />

    </section>


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminGrowth.marketplaceKicker')}</small>

          <h3>
            {t('adminGrowth.newRequests')}
          </h3>
        </div>

        <strong
          className={
            growth.bookingsGrowth>=0
              ? 'positive-growth'
              : 'negative-growth'
          }
        >
          {growth.bookingsGrowth>=0?'+':''}
          {growth.bookingsGrowth||0}%
        </strong>

      </div>

      <MiniBars
        items={commandTrends.bookings30||[]}
      />

    </section>


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminGrowth.revenueKicker')}</small>

          <h3>
            {t('adminGrowth.payments')}
          </h3>
        </div>

        <strong>
          <Euro value={executive.collectedThisMonth}/>
        </strong>

      </div>

      <MiniBars
        items={commandTrends.revenue30||[]}
        valueKey="amount"
      />

    </section>

  </div>


  <div className="admin-market-intelligence-grid">


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminMarketIntel.specialties.kicker')}</small>

          <h3>
            {t('adminMarketIntel.specialties.title')}
          </h3>
        </div>

      </div>


      <div className="admin-market-list">

        {(marketplaceCommand.specialties||[])
          .slice(0,8)
          .map((x:any,index:number)=>

            <div
              key={x.name}
              className="admin-market-row"
            >

              <span className="admin-market-rank">
                {index+1}
              </span>

              <div>
                <b>{x.name}</b>

                <small>
                  {x.activeProfessionals} pros
                </small>
              </div>

              <span>
                {x.bookings30}
                <small> requests</small>
              </span>

              <strong>
                {x.completed30}
                <small> completed</small>
              </strong>

            </div>

          )
        }

      </div>

    </section>


    <section className="admin-command-panel">

      <div className="admin-command-section-head">

        <div>
          <small>{t('adminMarketIntel.cities.kicker')}</small>

          <h3>
            {t('adminMarketIntel.cities.title')}
          </h3>
        </div>

      </div>


      <div className="admin-market-list">

        {(marketplaceCommand.cities||[])
          .slice(0,8)
          .map((x:any,index:number)=>

            <div
              key={x.name}
              className="admin-market-row"
            >

              <span className="admin-market-rank">
                {index+1}
              </span>

              <div>
                <b>{x.name}</b>

                <small>
                  {x.activeProfessionals} pros
                </small>
              </div>

              <span>
                {x.bookings30}
                <small> requests</small>
              </span>

              <strong>
                {x.completed30}
                <small> completed</small>
              </strong>

            </div>

          )
        }

      </div>

    </section>

  </div>


  <section className="admin-command-footer-status">

    <div>

      <span
        className={
          platformOperational
            ? 'operational'
            : 'attention'
        }
      />

      <div>
        <b>
          MELEO Operations Monitor
        </b>

        <small>
          {t('adminMarketIntel.footer.lastGenerated')} {' '}
          {command.generatedAt
            ? new Date(
                command.generatedAt
              ).toLocaleString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR')
            : '—'
          }
        </small>
      </div>

    </div>


    <div className="admin-command-footer-counters">

      <span>
        Critical
        <b>{criticalAlerts}</b>
      </span>

      <span>
        Warnings
        <b>{warningAlerts}</b>
      </span>

      <span>
        Attention
        <b>{totalAttention}</b>
      </span>

    </div>

  </section>

</>}
 {tab==='insights'&&<><div className="admin-grid-2"><div className="panel"><div className="panel-heading"><h3>Growth snapshot</h3><span>{t('adminInsights.window')}</span></div><div className="finance-lines"><span><i>{t('adminInsights.newMembers7')}</i><b>{insights.newUsers7}</b></span><span><i>{t('adminInsights.newMembers30')}</i><b>{insights.newUsers30}</b></span><span><i>{t('adminInsights.newRequests7')}</i><b>{insights.newBookings7}</b></span><span><i>{t('adminInsights.newRequests30')}</i><b>{insights.newBookings30}</b></span><span><i>Repeat patients</i><b>{mp.repeatPatients||0}</b></span><span><i>Suspended accounts</i><b>{mp.suspendedUsers||0}</b></span></div></div><div className="panel"><div className="panel-heading"><h3>Review quality</h3><span>Verified booking ratings</span></div><div className="review-distribution">{insights.reviewDist.map((r:any)=><div key={r.stars}><span>{r.stars} ★</span><i><b style={{width:`${mp.totalReviews?Math.max(2,r.count/mp.totalReviews*100):0}%`}}></b></i><strong>{r.count}</strong></div>)}</div></div></div><div className="panel admin-table-panel"><div className="table-toolbar"><div><h3>Top professionals</h3><span>{t('adminInsights.topProsSubtitle')}</span></div></div><div className="responsive-table"><table><thead><tr><th>{t('adminInsights.professional')}</th><th>{t('adminInsights.specialty')}</th><th>Plan</th><th>Impressions</th><th>Profile views</th><th>Requests</th><th>Completed</th><th>Rating</th></tr></thead><tbody>{insights.topPros.map((x:any)=><tr key={x.id}><td><b>{x.name}</b><small>{x.verified?'✓ MELEO Verified':'Not verified'}</small></td><td>{x.specialty||'—'}</td><td>{String(x.plan||'—').toUpperCase()}</td><td>{x.impressions}</td><td>{x.profileViews}</td><td>{x.requests}</td><td><b>{x.completed}</b></td><td>{x.rating?`${x.rating} ★ (${x.reviews})`:'—'}</td></tr>)}</tbody></table></div></div></>}
 {tab==='members'&&<div className="panel admin-table-panel"><div className="table-toolbar"><div><h3>{t('adminMembers.title')}</h3><span>{t('adminMembers.subtitle')}</span></div><div className="admin-filters"><input placeholder={t('adminMembers.searchPlaceholder')} value={query} onChange={e=>setQuery(e.target.value)}/><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">{t('adminMembers.filters.allRoles')}</option><option value="patient">{t('adminMembers.filters.patients')}</option><option value="professional">{t('adminMembers.filters.professionals')}</option></select><select value={planFilter} onChange={e=>setPlanFilter(e.target.value)}><option value="all">{t('adminMembers.filters.allPlans')}</option><option value="basic">Basic</option><option value="premium">Premium</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">{t('adminMembers.filters.allStatuses')}</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div></div><div className="responsive-table"><table><thead><tr><th>{t('adminMembers.columns.member')}</th><th>{t('adminMembers.columns.role')}</th><th>Plan</th><th>Verification</th><th>Account</th><th>{t('adminMembers.columns.area')}</th><th>{t('adminMembers.columns.registered')}</th><th>{t('adminMembers.columns.actions')}</th></tr></thead><tbody>{filteredMembers.map(m=><tr key={m.id} className={m.accountStatus==='suspended'?'row-suspended':''}><td><b>{m.name}</b><small>{m.email}</small><small>{m.phone||''}</small></td><td><span className="role-pill">{m.role==='professional'?m.specialty||t('adminMembers.role.professional'):t('adminMembers.role.patient')}</span></td><td>{m.role==='professional'?(m.subscriptionStatus==='active'?<span className={'plan-pill '+m.subscriptionPlan}>{String(m.subscriptionPlan).toUpperCase()} · {Number(m.subscriptionPrice||0).toFixed(2)}€</span>:<span className="verify-pill no">{m.subscriptionStatus||'No subscription'}</span>):'—'}</td><td>{m.role==='professional'?<span className={'verify-pill '+(m.verified?'yes':'pending')}>{m.verified?'✓ Verified':professionalLifecycleLabel(m.lifecycleStatus)}</span>:'—'}</td><td><span className={'account-state '+(m.accountStatus||'active')}>{m.accountStatus==='suspended'?'Suspended':'Active'}</span>{m.suspensionReason&&<small>{m.suspensionReason}</small>}</td><td>{m.city||'—'}</td><td>{new Date(m.createdAt).toLocaleDateString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}<small>{m.lastLoginAt?t('adminMembers.lastLogin')+' '+new Date(m.lastLoginAt).toLocaleDateString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR'):''}</small></td><td><div className="admin-actions">{m.accountStatus==='suspended'?<button onClick={()=>memberAction(m,'reactivate')}>{t('adminMembers.actions.reactivate')}</button>:<button className="danger-lite" onClick={()=>memberAction(m,'suspend')}>{t('adminMembers.actions.suspend')}</button>}{m.role==='professional'&&<>{m.verified?<button onClick={()=>memberAction(m,'unverify')}>Unverify</button>:<button className="positive-lite" onClick={()=>memberAction(m,'verify')}>Verify</button>}{m.featured?<button onClick={()=>memberAction(m,'unfeature')}>Remove featured</button>:<button onClick={()=>memberAction(m,'feature')}>Featured</button>}</>}</div></td></tr>)}</tbody></table></div></div>}
 {tab==='bookings'&&<div className="panel admin-table-panel"><div className="table-toolbar"><div><h3>{t('adminBookings.title')}</h3><span>{t('adminBookings.subtitle')}</span></div><div className="booking-summary"><span>GMV <b><Euro value={stats.bookings.completedGmv}/></b></span><span>Average <b><Euro value={stats.bookings.avgValue}/></b></span><span>Completion <b>{mp.bookingCompletionRate||0}%</b></span></div></div><div className="responsive-table"><table><thead><tr><th>{t('adminBookings.columns.idDate')}</th><th>{t('adminBookings.columns.customer')}</th><th>{t('adminBookings.columns.professional')}</th><th>{t('adminBookings.columns.service')}</th><th>Status</th><th>{t('adminBookings.columns.value')}</th></tr></thead><tbody>{bookings.map(b=>{const val=Number(b.agreedPrice??b.price??0);return <tr key={b.id}><td><b>{b.id.slice(0,12)}</b><small>{new Date(b.createdAt).toLocaleDateString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}</small></td><td>{b.patientName}</td><td><b>{b.professionalName}</b><small>{b.specialty}</small></td><td>{b.service}</td><td><span className={'status '+b.status}>{statusLabel(b.status)}</span></td><td>{val?<Euro value={val}/>:<span className="muted">—</span>}</td></tr>})}</tbody></table></div></div>}
 {tab==='revenue'&&<><div className="revenue-hero"><div><span>MONTHLY RECURRING REVENUE</span><strong><Euro value={stats.revenue.subscriptionMrr}/></strong><small>ARR <Euro value={stats.revenue.subscriptionArr}/> · collected this month <Euro value={stats.revenue.collectedRevenue}/></small></div><div className="revenue-breakdown"><span><i>BASIC</i><b>{stats.professionals.basic} × {money(9.99)}</b></span><span><i>PREMIUM</i><b>{stats.professionals.premium} × {money(14.99)}</b></span><span><i>Outstanding</i><b><Euro value={stats.revenue.outstanding}/></b></span><span><i>Failed charges</i><b>{stats.revenue.failedPayments}</b></span></div></div><div className="admin-grid-2"><div className="panel"><div className="panel-heading"><h3>Revenue health</h3><span>Subscription engine</span></div><div className="finance-lines"><span><i>MRR</i><b><Euro value={stats.revenue.subscriptionMrr}/></b></span><span><i>Collected current month</i><b><Euro value={stats.revenue.collectedRevenue}/></b></span><span><i>Failed value</i><b><Euro value={stats.revenue.failedRevenue}/></b></span><span><i>Past due professionals</i><b>{stats.professionals.pastDue}</b></span><span><i>Cancelled</i><b>{stats.professionals.churned}</b></span></div></div><div className="panel"><div className="panel-heading"><h3>Marketplace economics</h3><span>Informational</span></div><div className="finance-lines"><span><i>Completed GMV</i><b><Euro value={stats.revenue.marketplaceGmv}/></b></span><span><i>Avg completed booking</i><b><Euro value={stats.bookings.avgValue}/></b></span><span><i>Platform take rate</i><b>0%</b></span><span><i>Revenue model</i><b>Subscriptions only</b></span></div></div></div><div className="admin-finance-note">{t('adminRevenue.gmvNote')}</div></>}
 {tab==='subs'&&<AdminSubscriptions token={token} setToast={setToast}/>} 
 {tab==='verification'&&<div className="panel"><div className="panel-heading"><h3>Verification Operations</h3><span>Manual & submitted professional verification</span></div>{vers.length?vers.map(v=><div className="admin-row" key={v.id}><div><b>{v.name}</b><span>{v.specialty||'Επαγγελματίας'} · {v.subscriptionPlan?String(v.subscriptionPlan).toUpperCase():'—'} · {v.city||'—'}</span><span>{v.email||'—'} · {v.phone||'—'}</span><span>Άδεια/μητρώο: {v.licenseNumber||'—'} · Δικαιολογητικά: {v.documentCount||0}</span>{v.documents?.length>0&&<span className="verification-doc-links">{v.documents.map((d:any)=><a key={d.id} href={`/api/admin/verification-documents/${d.id}`}>Λήψη: {d.name}</a>)}</span>}<small>{v.createdAt?.slice(0,16).replace('T',' ')}</small></div><span className={'status '+v.status}>{v.status}</span><div className="admin-actions">{v.status!=='approved'&&<button className="positive-lite" onClick={()=>decide(v.id,'approved')}>Έγκριση</button>}{v.status!=='rejected'&&<button className="danger-lite" onClick={()=>decide(v.id,'rejected')}>Απόρριψη</button>}</div></div>):<Empty title="Καμία εκκρεμότητα" text="Τα νέα αιτήματα verification θα εμφανίζονται εδώ."/>}</div>}
 {tab==='support'&&<AdminSupport token={token} setToast={setToast}/>} {tab==='smart'&&<AdminSmartRequests token={token} setToast={setToast}/>} {tab==='audit'&&<div className="panel admin-table-panel"><div className="table-toolbar"><div><h3>Audit Log</h3><span>Ιχνηλασιμότητα κρίσιμων ενεργειών Admin και συστήματος</span></div><button className="btn ghost small" onClick={refresh}>Ανανέωση</button></div><div className="responsive-table"><table><thead><tr><th>Χρόνος</th><th>Actor</th><th>Action</th><th>Metadata</th></tr></thead><tbody>{auditRows.map((x:any)=><tr key={x.id}><td>{new Date(x.at).toLocaleString(i18n.resolvedLanguage==='en'?'en-GB':'el-GR')}</td><td><b>{x.actorName}</b><small>{x.actorEmail}</small></td><td><code>{x.action}</code></td><td><small className="audit-meta">{JSON.stringify(x.meta||{})}</small></td></tr>)}</tbody></table></div></div>}
 </div></section>
}

function AdminSmartRequests({token,setToast}:any){

 const [rows,setRows]=useState<any[]>([])
 const [summary,setSummary]=useState<any>({})
 const [status,setStatus]=useState('all')
 const [query,setQuery]=useState('')
 const [busy,setBusy]=useState('')

 async function load(){

   try{

     const params=new URLSearchParams()

     if(status!=='all'){
       params.set('status',status)
     }

     if(query.trim()){
       params.set('q',query.trim())
     }

     const d=await api(
       '/admin/smart-requests?'+params.toString(),
       {},
       token
     )

     setRows(
       Array.isArray(d)
         ?d
         :(d.items||[])
     )

     setSummary(d.summary||{})

   }
   catch(e:any){

     setToast(
       e.message||
       'Αποτυχία φόρτωσης Smart Requests.'
     )

   }

 }

 useEffect(()=>{
   load()
 },[status])

 async function decision(
   row:any,
   nextStatus:string
 ){

   let specialty=row.specialty||''
   let service=row.service||''
   let note=row.note||''

   if(nextStatus==='learned'){

     specialty=
       window.prompt(
         'Σε ποια ειδικότητα ανήκει;',
         specialty
       )||''

     if(!specialty.trim()){
       return
     }

     service=
       window.prompt(
         'Υπηρεσία (προαιρετικό):',
         service
       )||''

   }

   if(
     nextStatus==='ignored'||
     nextStatus==='reviewed'
   ){

     note=
       window.prompt(
         'Εσωτερική σημείωση (προαιρετικό):',
         note
       )||''

   }

   setBusy(row.id+nextStatus)

   try{

     await api(
       '/admin/smart-requests/'+row.id,
       {
         method:'PATCH',
         body:JSON.stringify({
           status:nextStatus,
           specialty,
           service,
           note
         })
       },
       token
     )

     await load()

     setToast(
       nextStatus==='learned'
         ?'Το Smart Request προστέθηκε στη γνώση της MELEO.'
         :'Η κατάσταση ενημερώθηκε.'
     )

   }
   catch(e:any){

     setToast(
       e.message||
       'Η ενέργεια απέτυχε.'
     )

   }
   finally{
     setBusy('')
   }

 }

 return (

   <div className="admin-smart-learning">

     <div className="admin-grid-4">

       <div className="panel">
         <small>NEW</small>
         <h2>{summary.new||0}</h2>
         <span>Νέα άγνωστα αιτήματα</span>
       </div>

       <div className="panel">
         <small>LEARNED</small>
         <h2>{summary.learned||0}</h2>
         <span>Εκπαιδευμένες φράσεις</span>
       </div>

       <div className="panel">
         <small>TOTAL PATTERNS</small>
         <h2>{summary.total||0}</h2>
         <span>Μοναδικά patterns</span>
       </div>

       <div className="panel">
         <small>REQUEST SIGNALS</small>
         <h2>{summary.occurrences||0}</h2>
         <span>Συνολικές εμφανίσεις</span>
       </div>

     </div>

     <div className="panel">

       <div className="panel-heading">

         <div>
           <h3>🧠 Smart Request Learning</h3>
           <span>
             Πραγματικά αιτήματα που δεν αναγνώρισε
             ο Smart Request matcher
           </span>
         </div>

         <button
           className="btn ghost small"
           onClick={load}
         >
           ↻ Ανανέωση
         </button>

       </div>

       <div className="table-toolbar">

         <input
           value={query}
           onChange={e=>setQuery(e.target.value)}
           onKeyDown={e=>{
             if(e.key==='Enter')load()
           }}
           placeholder="Αναζήτηση αιτήματος…"
         />

         <select
           value={status}
           onChange={e=>setStatus(e.target.value)}
         >
           <option value="all">Όλα</option>
           <option value="new">New</option>
           <option value="reviewed">Reviewed</option>
           <option value="learned">Learned</option>
           <option value="ignored">Ignored</option>
         </select>

         <button
           className="btn small"
           onClick={load}
         >
           Αναζήτηση
         </button>

       </div>

       {rows.length
         ?rows.map((r:any)=>(

           <div
             className="admin-row smart-learning-row"
             key={r.id}
           >

             <div>

               <b>
                 “{r.text}”
               </b>

               <span>
                 {r.occurrences} εμφάνιση
                 {r.occurrences===1?'':'εις'}
               </span>

               {r.specialty&&(
                 <span>
                   🎯 {r.specialty}
                   {r.service
                     ?` · ${r.service}`
                     :''
                   }
                 </span>
               )}

               <small>
                 Πρώτη:
                 {' '}
                 {new Date(
                   r.firstSeenAt
                 ).toLocaleString('el-GR')}
                 {' · '}
                 Τελευταία:
                 {' '}
                 {new Date(
                   r.lastSeenAt
                 ).toLocaleString('el-GR')}
               </small>

             </div>

             <span
               className={'status '+r.status}
             >
               {r.status}
             </span>

             <div className="admin-actions">

               {r.status!=='learned'&&(
                 <button
                   className="positive-lite"
                   disabled={
                     busy===r.id+'learned'
                   }
                   onClick={()=>
                     decision(r,'learned')
                   }
                 >
                   🧠 Learn
                 </button>
               )}

               {r.status!=='reviewed'&&(
                 <button
                   disabled={
                     busy===r.id+'reviewed'
                   }
                   onClick={()=>
                     decision(r,'reviewed')
                   }
                 >
                   Reviewed
                 </button>
               )}

               {r.status!=='ignored'&&(
                 <button
                   className="danger-lite"
                   disabled={
                     busy===r.id+'ignored'
                   }
                   onClick={()=>
                     decision(r,'ignored')
                   }
                 >
                   Ignore
                 </button>
               )}

             </div>

           </div>

         ))
         :(
           <Empty
             title="Δεν υπάρχουν Smart Requests"
             text="Όταν ο matcher δεν μπορεί να καταλάβει ένα αίτημα, θα εμφανίζεται εδώ."
           />
         )
       }

     </div>

   </div>

 )
}

function AdminSupport({token,setToast}:any){
 const [rows,setRows]=useState<any[]>([]);const [reply,setReply]=useState<Record<string,string>>({});async function load(){const d=await api('/support/tickets?limit=100',{},token);setRows(Array.isArray(d)?d:(d.items||[]))}useEffect(()=>{load()},[])
 async function update(id:string,status:string){await api('/support/tickets/'+id,{method:'PATCH',body:JSON.stringify({status})},token);load()}
 async function send(id:string){const text=reply[id]||'';if(!text.trim())return;await api('/support/tickets/'+id+'/message',{method:'POST',body:JSON.stringify({text})},token);setReply({...reply,[id]:''});load();setToast('Η απάντηση στάλθηκε.')}
 return <div className="panel admin-support"><div className="panel-heading"><div><h3>Customer Support</h3><span>Tickets χρηστών και επαγγελματιών</span></div><strong>{rows.filter(x=>x.status!=='closed').length} open</strong></div>{rows.length?rows.map(t=><div className="admin-ticket" key={t.id}><div className="support-ticket-head"><div><b>{t.subject}</b><small>{t.category} · {t.id}</small></div><select value={t.status} onChange={e=>update(t.id,e.target.value)}><option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option></select></div><div className="support-thread">{t.messages.map((m:any)=><div className={'support-message '+m.fromRole} key={m.id}><b>{m.fromName}</b><p>{m.text}</p><small>{new Date(m.createdAt).toLocaleString('el-GR')}</small></div>)}</div><div className="support-reply"><input value={reply[t.id]||''} onChange={e=>setReply({...reply,[t.id]:e.target.value})} placeholder="Απάντηση από MELEO Support…"/><button onClick={()=>send(t.id)}>Αποστολή</button></div></div>):<Empty title="Δεν υπάρχουν tickets" text="Τα νέα αιτήματα υποστήριξης θα εμφανίζονται εδώ."/>}</div>
}

export default Admin
