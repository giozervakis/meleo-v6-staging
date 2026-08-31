import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'
function SectionTitle({over,title,subtitle}:any){return <div className="section-title"><div className="eyebrow">{over}</div><h2>{title}</h2><p>{subtitle}</p></div>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}
function NotificationsPage({
  user,
  token,
  setToast,
  embedded=false
}:any){

  const {t,i18n}=useTranslation()

  const locale=
    i18n.resolvedLanguage==='en'
      ? 'en-GB'
      : 'el-GR'

  const [rows,setRows]=useState<any[]>([])
  const [unread,setUnread]=useState(0)
  const [filter,setFilter]=useState<'all'|'messages'|'bookings'|'system'>('all')
  const [loading,setLoading]=useState(true)

  const [permission,setPermission]=useState(
    typeof Notification!=='undefined'
      ? Notification.permission
      : 'unsupported'
  )

  async function load(){
    try{
      const d=await api(
        '/notifications?limit=100',
        {},
        token
      )

      const items=
        Array.isArray(d)
          ? d
          : d.items||[]

      setRows(items)

      setUnread(
        Number(
          Array.isArray(d)
            ? items.filter((x:any)=>!x.read).length
            : d.unread||0
        )
      )
    }
    catch(e:any){
      console.error(
        'Notifications load failed',
        e
      )
    }
    finally{
      setLoading(false)
    }
  }


  useEffect(()=>{

    load()

    const onLive=()=>{
      load()
    }

    window.addEventListener(
      'meleo:live',
      onLive
    )

    return ()=>{
      window.removeEventListener(
        'meleo:live',
        onLive
      )
    }

  },[user?.id])


  async function enable(){

    if(!('Notification' in window)){
      return setToast(
        t(
          'supportPages.notifications.toast.unsupported'
        )
      )
    }

    const p=
      await Notification.requestPermission()

    setPermission(p)

    setToast(
      p==='granted'
        ? t(
            'supportPages.notifications.toast.enabled'
          )
        : t(
            'supportPages.notifications.toast.denied'
          )
    )
  }


  function notificationActionUrl(
    notification:any
  ){

    const raw=
      String(
        notification?.actionUrl||
        ''
      ).trim()

    if(!raw){
      return ''
    }

    if(
      !raw.startsWith('/') ||
      raw.startsWith('//')
    ){
      return ''
    }

    try{
      const parsed=
        new URL(
          raw,
          window.location.origin
        )

      /*
       * Legacy MELEO professional deep links used:
       *   /professional?tab=billing
       *
       * The actual routed dashboard path is:
       *   /professional/dashboard
       *
       * Keep old notifications working while all new notifications
       * use the canonical dashboard route.
       */
      if(parsed.pathname==='/professional'){
        parsed.pathname='/professional/dashboard'
      }

      const aliases:Record<string,string>={
        billing:'subscription',
        subscription:'subscription',
        requests:'requests',
        bookings:'requests',
        messages:'messages',
        verification:'verification',
        notifications:'notifications',
        support:'support',
        profile:'profile',
        availability:'availability',
        reputation:'reputation',
        overview:'overview'
      }

      const requestedTab=
        String(
          parsed.searchParams.get('tab')||
          ''
        ).toLowerCase()

      if(requestedTab){
        parsed.searchParams.set(
          'tab',
          aliases[requestedTab]||
          requestedTab
        )
      }

      return (
        parsed.pathname+
        parsed.search+
        parsed.hash
      )
    }
    catch{
      return ''
    }
  }
  async function mark(
    notification:any
  ){

    if(!notification.read){

      await api(
        '/notifications/'+notification.id+'/read',
        {
          method:'PATCH'
        },
        token
      )

      await load()
    }

    const url=
      notificationActionUrl(
        notification
      )

    if(url){
      window.history.pushState(
        {},
        '',
        url
      )

      window.dispatchEvent(
        new PopStateEvent('popstate')
      )
    }
  }



  async function markAll(){

    if(!unread){
      return
    }

    try{

      await api(
        '/notifications/read-all',
        {
          method:'PATCH'
        },
        token
      )

      await load()

      setToast(
        t(
          'supportPages.notifications.toast.allRead'
        )
      )

    }
    catch(e:any){

      setToast(
        e.message||
        t(
          'supportPages.notifications.toast.actionFailed'
        )
      )

    }
  }


  function groupFor(
    n:any
  ){

    if(
      n.type==='message' ||
      n.type==='support'
    ){
      return 'messages'
    }

    if(
      n.type==='booking' ||
      n.type==='quote' ||
      n.actionType==='booking'
    ){
      return 'bookings'
    }

    return 'system'
  }


  function iconFor(
    n:any
  ){

    if(n.type==='message'){
      return '💬'
    }

    if(n.type==='support'){
      return '?'
    }

    if(n.type==='booking'){
      return '⌁'
    }

    if(n.type==='quote'){
      return '€'
    }

    if(n.type==='verification'){
      return '✓'
    }

    if(
      n.type==='billing' ||
      n.type==='subscription'
    ){
      return '◇'
    }

    if(n.type==='review'){
      return '★'
    }

    return '🔔'
  }


  function timeLabel(
    value:string
  ){

    if(!value){
      return ''
    }

    const date=
      new Date(value)

    const diff=
      Date.now()-date.getTime()

    const minutes=
      Math.floor(
        diff/60000
      )

    if(minutes<1){
      return t(
        'supportPages.notifications.time.now'
      )
    }

    if(minutes<60){
      return t(
        'supportPages.notifications.time.minutes',
        {
          count:minutes
        }
      )
    }

    const hours=
      Math.floor(
        minutes/60
      )

    if(hours<24){
      return t(
        'supportPages.notifications.time.hours',
        {
          count:hours
        }
      )
    }

    const days=
      Math.floor(
        hours/24
      )

    if(days<7){
      return t(
        'supportPages.notifications.time.days',
        {
          count:days
        }
      )
    }

    return date.toLocaleString(
      locale
    )
  }


  const filtered=
    rows.filter(
      (n:any)=>
        filter==='all' ||
        groupFor(n)===filter
    )


  const messageCount=
    rows.filter(
      (n:any)=>
        !n.read &&
        groupFor(n)==='messages'
    ).length


  const bookingCount=
    rows.filter(
      (n:any)=>
        !n.read &&
        groupFor(n)==='bookings'
    ).length


  const systemCount=
    rows.filter(
      (n:any)=>
        !n.read &&
        groupFor(n)==='system'
    ).length


  const body=(
    <div className="container narrow notifications-center-v2">

      <section className="notifications-command-hero">

        <div className="notifications-command-copy">

          <div className="notifications-live-kicker">
            <span/>
            MELEO LIVE
          </div>

          <h2>
            {t(
              'supportPages.notifications.hero.title'
            )}
          </h2>

          <p>
            {t(
              'supportPages.notifications.hero.text'
            )}
          </p>

        </div>


        <div className="notifications-command-summary">

          <div>

            <small>
              {t(
                'supportPages.notifications.hero.unread'
              )}
            </small>

            <strong>
              {unread}
            </strong>

          </div>


          <button
            className="btn btn-dark"
            onClick={enable}
          >
            {permission==='granted'
              ? '✓ '+t(
                  'supportPages.notifications.browser.enabled'
                )
              : t(
                  'supportPages.notifications.browser.enable'
                )
            }
          </button>

        </div>

      </section>


      <section className="notifications-toolbar-v2">

        <div className="notifications-filters">

          <button
            className={
              filter==='all'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('all')}
          >
            {t(
              'supportPages.notifications.filters.all'
            )}

            {unread>0&&
              <span>
                {unread}
              </span>
            }
          </button>


          <button
            className={
              filter==='messages'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('messages')}
          >
            {t(
              'supportPages.notifications.filters.messages'
            )}

            {messageCount>0&&
              <span>
                {messageCount}
              </span>
            }
          </button>


          <button
            className={
              filter==='bookings'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('bookings')}
          >
            {t(
              'supportPages.notifications.filters.bookings'
            )}

            {bookingCount>0&&
              <span>
                {bookingCount}
              </span>
            }
          </button>


          <button
            className={
              filter==='system'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('system')}
          >
            {t(
              'supportPages.notifications.filters.system'
            )}

            {systemCount>0&&
              <span>
                {systemCount}
              </span>
            }
          </button>

        </div>


        <button
          className="notifications-mark-all"
          onClick={markAll}
          disabled={!unread}
        >
          ✓ {t(
            'supportPages.notifications.markAll'
          )}
        </button>

      </section>


      <section className="notification-list notification-list-v2">

        {loading
          ? <div className="notifications-loading">
              {t(
                'supportPages.notifications.loading'
              )}
            </div>

          : filtered.length

            ? filtered.map(
                (n:any)=>

                  <button
                    key={n.id}
                    className={
                      'notification-row notification-row-v2 '+
                      (!n.read?'unread ':'')+
                      `priority-${n.priority||'normal'} `+
                      (n.actionUrl?'actionable':'')
                    }
                    onClick={()=>mark(n)}
                  >

                    <div className="notification-v2-icon">

                      <span>
                        {iconFor(n)}
                      </span>

                      {!n.read&&
                        <i/>
                      }

                    </div>


                    <div className="notification-v2-content">

                      <div className="notification-v2-head">

                        <b>
                          {n.title}
                        </b>

                        <small>
                          {timeLabel(n.createdAt)}
                        </small>

                      </div>

                      {n.text&&
                        <p>
                          {n.text}
                        </p>
                      }

                      <div className="notification-v2-meta">

                        <span>
                          {groupFor(n)==='messages'
                            ? t(
                                'supportPages.notifications.meta.communication'
                              )
                            : groupFor(n)==='bookings'
                              ? t(
                                  'supportPages.notifications.meta.booking'
                                )
                              : 'MELEO'
                          }
                        </span>

                        {n.priority==='high'&&
                          <span className="notification-priority high">
                            {t(
                              'supportPages.notifications.priority.high'
                            )}
                          </span>
                        }

                        {n.priority==='critical'&&
                          <span className="notification-priority critical">
                            {t(
                              'supportPages.notifications.priority.critical'
                            )}
                          </span>
                        }

                        {n.actionUrl&&
                          <span className="notification-action-hint">
                            {t(
                              'supportPages.notifications.view'
                            )} →
                          </span>
                        }

                      </div>

                    </div>


                    {!n.read&&
                      <span className="notification-v2-unread">
                        {t(
                          'supportPages.notifications.new'
                        )}
                      </span>
                    }

                  </button>
              )

            : <Empty
                title={
                  filter==='all'
                    ? t(
                        'supportPages.notifications.empty.allTitle'
                      )
                    : t(
                        'supportPages.notifications.empty.filterTitle'
                      )
                }
                text={
                  filter==='all'
                    ? t(
                        'supportPages.notifications.empty.allText'
                      )
                    : t(
                        'supportPages.notifications.empty.filterText'
                      )
                }
              />
        }

      </section>


      <section className="notifications-live-info">

        <div>

          <span className="notifications-live-dot"/>

          <div>
            <b>
              {t(
                'supportPages.notifications.live.title'
              )}
            </b>

            <small>
              {t(
                'supportPages.notifications.live.text'
              )}
            </small>
          </div>

        </div>

        <small>
          {t(
            'supportPages.notifications.live.background'
          )}
        </small>

      </section>

    </div>
  )


  return embedded
    ? <div className="embedded-page">
        {body}
      </div>

    : <section className="page notifications-page">
        {body}
      </section>
}
function HelpCenter({user,token,setToast,cfg,embedded=false}:any){
 const {t,i18n}=useTranslation()
 const locale=i18n.resolvedLanguage==='en'?'en-GB':'el-GR'
 const [tickets,setTickets]=useState<any[]>([])
 const [f,setF]=useState({subject:'',category:'booking',text:''})
 const [reply,setReply]=useState('')

 async function load(){
  if(user){
   const d=await api('/support/tickets?limit=50',{},token)
   setTickets(Array.isArray(d)?d:(d.items||[]))
  }
 }

 useEffect(()=>{
  load()
  const fn=()=>load()
  window.addEventListener('meleo:live',fn)
  return()=>window.removeEventListener('meleo:live',fn)
 },[user?.id])

 async function create(){
  if(!user){
   return setToast(
    t('supportPages.help.toast.login')
   )
  }

  await api(
   '/support/tickets',
   {
    method:'POST',
    body:JSON.stringify(f)
   },
   token
  )

  setF({
   subject:'',
   category:'booking',
   text:''
  })

  await load()

  setToast(
   t('supportPages.help.toast.created')
  )
 }

 async function send(id:string){
  if(!reply.trim()){
   return
  }

  await api(
   '/support/tickets/'+id+'/message',
   {
    method:'POST',
    body:JSON.stringify({
     text:reply
    })
   },
   token
  )

  setReply('')
  load()
 }

 const body=
  <div className="container">

   <SectionTitle
    over="MELEO SUPPORT"
    title={t('supportPages.help.title')}
    subtitle={t('supportPages.help.subtitle')}
   />

   <div className="help-grid">

    <div className="panel">
     <h3>
      {t('supportPages.help.quick.title')}
     </h3>

     <div className="faq-list">

      <details>
       <summary>
        {t('supportPages.help.quick.bookingQ')}
       </summary>
       <p>
        {t('supportPages.help.quick.bookingA')}
       </p>
      </details>

      <details>
       <summary>
        {t('supportPages.help.quick.verifiedQ')}
       </summary>
       <p>
        {t('supportPages.help.quick.verifiedA')}
       </p>
      </details>

      <details>
       <summary>
        {t('supportPages.help.quick.cancelQ')}
       </summary>
       <p>
        {t('supportPages.help.quick.cancelA')}
       </p>
      </details>

      <details>
       <summary>
        {t('supportPages.help.quick.emergencyQ')}
       </summary>
       <p>
        {t(
         'supportPages.help.quick.emergencyA',
         {
          number:
           cfg?.emergencyNumber||
           '112'
         }
        )}
       </p>
      </details>

     </div>

     <a
      className="support-mail"
      href={
       `mailto:${cfg?.legal?.supportEmail||'support@meleo.gr'}`
      }
     >
      ✉ {cfg?.legal?.supportEmail||'support@meleo.gr'}
     </a>
    </div>

    <div className="panel support-create">

     <h3>
      {t('supportPages.help.create.title')}
     </h3>

     {user
      ? <>
         <label>
          {t('supportPages.help.create.category')}

          <select
           value={f.category}
           onChange={e=>
            setF({
             ...f,
             category:e.target.value
            })
           }
          >
           <option value="booking">
            {t('supportPages.help.categories.booking')}
           </option>
           <option value="billing">
            {t('supportPages.help.categories.billing')}
           </option>
           <option value="verification">
            Verification
           </option>
           <option value="account">
            {t('supportPages.help.categories.account')}
           </option>
           <option value="technical">
            {t('supportPages.help.categories.technical')}
           </option>
           <option value="general">
            {t('supportPages.help.categories.general')}
           </option>
          </select>
         </label>

         <label>
          {t('supportPages.help.create.subject')}

          <input
           value={f.subject}
           onChange={e=>
            setF({
             ...f,
             subject:e.target.value
            })
           }
          />
         </label>

         <label>
          {t('supportPages.help.create.description')}

          <textarea
           value={f.text}
           onChange={e=>
            setF({
             ...f,
             text:e.target.value
            })
           }
          />
         </label>

         <button
          className="btn btn-dark"
          onClick={create}
         >
          {t('supportPages.help.create.submit')}
         </button>
        </>
      : <p>
         {t('supportPages.help.create.loginText')}
        </p>
     }

    </div>
   </div>

   {user&&
    <div className="support-tickets">

     <h3>
      {t('supportPages.help.tickets.title')}
     </h3>

     {tickets.length
      ? tickets.map(t=>
         <div
          className="support-ticket"
          key={t.id}
         >

          <div className="support-ticket-head">
           <div>
            <b>
             {t.subject}
            </b>

            <small>
             {t.category}
             {' · '}
             {new Date(
              t.createdAt
             ).toLocaleString(locale)}
            </small>
           </div>

           <span
            className={
             'status '+
             (
              t.status==='closed'
               ? 'completed'
               : 'pending'
             )
            }
           >
            {t.status}
           </span>
          </div>

          <div className="support-thread">
           {t.messages.map((m:any)=>
            <div
             className={
              'support-message '+
              m.fromRole
             }
             key={m.id}
            >
             <b>
              {m.fromName}
             </b>

             <p>
              {m.text}
             </p>

             <small>
              {new Date(
               m.createdAt
              ).toLocaleString(locale)}
             </small>
            </div>
           )}
          </div>

          {t.status!=='closed'&&
           <div className="support-reply">

            <input
             placeholder={t(
              'supportPages.help.reply.placeholder'
             )}
             value={reply}
             onChange={e=>
              setReply(e.target.value)
             }
            />

            <button
             onClick={()=>send(t.id)}
            >
             {t(
              'supportPages.help.reply.send'
             )}
            </button>

           </div>
          }

         </div>
        )
      : <Empty
         title={t(
          'supportPages.help.tickets.emptyTitle'
         )}
         text={t(
          'supportPages.help.tickets.emptyText'
         )}
        />
     }

    </div>
   }

  </div>

 return embedded
  ? <div className="embedded-page">
     {body}
    </div>
  : <section className="page help-page">
     {body}
    </section>
}

export { NotificationsPage, HelpCenter }
