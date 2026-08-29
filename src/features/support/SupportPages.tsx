import React, { useEffect, useState } from 'react'
import { api } from '../../lib/api'
function SectionTitle({over,title,subtitle}:any){return <div className="section-title"><div className="eyebrow">{over}</div><h2>{title}</h2><p>{subtitle}</p></div>}
function Empty({title,text}:any){return <div className="empty"><div>◇</div><h3>{title}</h3><p>{text}</p></div>}
function NotificationsPage({
  user,
  token,
  setToast,
  embedded=false
}:any){

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
        'Ο browser δεν υποστηρίζει ειδοποιήσεις.'
      )
    }

    const p=
      await Notification.requestPermission()

    setPermission(p)

    setToast(
      p==='granted'
        ? 'Οι browser ειδοποιήσεις ενεργοποιήθηκαν.'
        : 'Δεν δόθηκε άδεια ειδοποιήσεων.'
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
        'Όλες οι ειδοποιήσεις σημειώθηκαν ως διαβασμένες.'
      )

    }
    catch(e:any){

      setToast(
        e.message||
        'Η ενέργεια απέτυχε.'
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
      return 'Μόλις τώρα'
    }

    if(minutes<60){
      return `${minutes} λεπτά πριν`
    }

    const hours=
      Math.floor(
        minutes/60
      )

    if(hours<24){
      return `${hours} ώρες πριν`
    }

    const days=
      Math.floor(
        hours/24
      )

    if(days<7){
      return `${days} ημέρες πριν`
    }

    return date.toLocaleString(
      'el-GR'
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
            Κέντρο Ειδοποιήσεων
          </h2>

          <p>
            Μηνύματα, κρατήσεις, προτάσεις κόστους,
            verification και σημαντικές ενημερώσεις
            εμφανίζονται εδώ σε πραγματικό χρόνο.
          </p>

        </div>


        <div className="notifications-command-summary">

          <div>

            <small>
              ΑΔΙΑΒΑΣΤΕΣ
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
              ? '✓ Browser notifications'
              : 'Ενεργοποίηση browser notifications'
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
            Όλα

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
            Μηνύματα

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
            Κρατήσεις

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
            Σύστημα

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
          ✓ Σήμανση όλων ως διαβασμένα
        </button>

      </section>


      <section className="notification-list notification-list-v2">

        {loading
          ? <div className="notifications-loading">
              Φόρτωση ειδοποιήσεων…
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
                            ? 'Επικοινωνία'
                            : groupFor(n)==='bookings'
                              ? 'Κράτηση'
                              : 'MELEO'
                          }
                        </span>

                        {n.priority==='high'&&
                          <span className="notification-priority high">
                            Σημαντικό
                          </span>
                        }

                        {n.priority==='critical'&&
                          <span className="notification-priority critical">
                            Κρίσιμο
                          </span>
                        }

                        {n.actionUrl&&
                          <span className="notification-action-hint">
                            Προβολή →
                          </span>
                        }

                      </div>

                    </div>


                    {!n.read&&
                      <span className="notification-v2-unread">
                        ΝΕΟ
                      </span>
                    }

                  </button>
              )

            : <Empty
                title={
                  filter==='all'
                    ? 'Δεν υπάρχουν ειδοποιήσεις'
                    : 'Δεν υπάρχουν ειδοποιήσεις σε αυτή την κατηγορία'
                }
                text={
                  filter==='all'
                    ? 'Όταν υπάρξει νέα δραστηριότητα θα εμφανιστεί εδώ.'
                    : 'Δοκίμασε διαφορετικό φίλτρο.'
                }
              />
        }

      </section>


      <section className="notifications-live-info">

        <div>

          <span className="notifications-live-dot"/>

          <div>
            <b>
              Real-time σύνδεση MELEO
            </b>

            <small>
              Οι ενημερώσεις εμφανίζονται χωρίς ανανέωση της σελίδας.
            </small>
          </div>

        </div>

        <small>
          Για background ειδοποιήσεις όταν ο browser είναι κλειστός
          απαιτείται Web Push / VAPID configuration.
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
 const [tickets,setTickets]=useState<any[]>([]);const [f,setF]=useState({subject:'',category:'booking',text:''});const [reply,setReply]=useState('')
 async function load(){if(user){const d=await api('/support/tickets?limit=50',{},token);setTickets(Array.isArray(d)?d:(d.items||[]))}}useEffect(()=>{load();const fn=()=>load();window.addEventListener('meleo:live',fn);return()=>window.removeEventListener('meleo:live',fn)},[user?.id])
 async function create(){if(!user)return setToast('Συνδέσου για να ανοίξεις αίτημα υποστήριξης.');await api('/support/tickets',{method:'POST',body:JSON.stringify(f)},token);setF({subject:'',category:'booking',text:''});await load();setToast('Το αίτημα υποστήριξης δημιουργήθηκε.')}
 async function send(id:string){if(!reply.trim())return;await api('/support/tickets/'+id+'/message',{method:'POST',body:JSON.stringify({text:reply})},token);setReply('');load()}
 const body=<div className="container"><SectionTitle over="MELEO SUPPORT" title="Help Center" subtitle="Άμεση βοήθεια για κρατήσεις, λογαριασμό, συνδρομές, verification και λειτουργία της πλατφόρμας."/><div className="help-grid"><div className="panel"><h3>Γρήγορες απαντήσεις</h3><div className="faq-list"><details><summary>Πώς λειτουργεί μια κράτηση;</summary><p>Αίτημα → διευκρινίσεις → τελικό κόστος → αποδοχή → επιβεβαιωμένη επίσκεψη.</p></details><details><summary>Πώς γίνεται το MELEO Verified;</summary><p>Ο επαγγελματίας υποβάλλει τα απαιτούμενα δικαιολογητικά και η ομάδα MELEO ολοκληρώνει τον έλεγχο.</p></details><details><summary>Πώς ακυρώνω συνδρομή;</summary><p>Από το Professional Dashboard → Συνδρομή. Η ακύρωση ισχύει στο τέλος της πληρωμένης περιόδου.</p></details><details><summary>Έχω επείγουσα ανάγκη.</summary><p>Η MELEO δεν είναι υπηρεσία επειγόντων. Σε επείγουσα κατάσταση κάλεσε {cfg?.emergencyNumber||'112'}.</p></details></div><a className="support-mail" href={`mailto:${cfg?.legal?.supportEmail||'support@meleo.gr'}`}>✉ {cfg?.legal?.supportEmail||'support@meleo.gr'}</a></div><div className="panel support-create"><h3>Νέο αίτημα υποστήριξης</h3>{user?<><label>Κατηγορία<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}><option value="booking">Κράτηση</option><option value="billing">Συνδρομή / Χρέωση</option><option value="verification">Verification</option><option value="account">Λογαριασμός</option><option value="technical">Τεχνικό θέμα</option><option value="general">Άλλο</option></select></label><label>Θέμα<input value={f.subject} onChange={e=>setF({...f,subject:e.target.value})}/></label><label>Περιγραφή<textarea value={f.text} onChange={e=>setF({...f,text:e.target.value})}/></label><button className="btn btn-dark" onClick={create}>Αποστολή στην υποστήριξη</button></>:<p>Συνδέσου για να δημιουργήσεις ticket και να παρακολουθείς τις απαντήσεις της ομάδας MELEO.</p>}</div></div>{user&&<div className="support-tickets"><h3>Τα αιτήματά μου</h3>{tickets.length?tickets.map(t=><div className="support-ticket" key={t.id}><div className="support-ticket-head"><div><b>{t.subject}</b><small>{t.category} · {new Date(t.createdAt).toLocaleString('el-GR')}</small></div><span className={'status '+(t.status==='closed'?'completed':'pending')}>{t.status}</span></div><div className="support-thread">{t.messages.map((m:any)=><div className={'support-message '+m.fromRole} key={m.id}><b>{m.fromName}</b><p>{m.text}</p><small>{new Date(m.createdAt).toLocaleString('el-GR')}</small></div>)}</div>{t.status!=='closed'&&<div className="support-reply"><input placeholder="Απάντηση…" value={reply} onChange={e=>setReply(e.target.value)}/><button onClick={()=>send(t.id)}>Αποστολή</button></div>}</div>):<Empty title="Δεν έχεις ανοικτά αιτήματα" text="Η ομάδα υποστήριξης είναι εδώ όταν τη χρειαστείς."/>}</div>}</div>
 return embedded?<div className="embedded-page">{body}</div>:<section className="page help-page">{body}</section>
}

export { NotificationsPage, HelpCenter }
