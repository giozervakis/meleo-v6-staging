import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { api } from '../../../lib/api'
import type { Booking } from '../../../domain/types'

import './professional-messages.css'

type Props = {
  bookings: Booking[]
  token: string
  user: any
  unreadByBooking: Record<string,number>
  unreadTotal: number
  onRefresh: () => Promise<any> | any
  onUnreadRefresh: () => Promise<any> | any
  setToast?: (message:string)=>void
}

type Filter = 'all'|'unread'

function initials(value:string){
  const parts=String(value||'')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if(!parts.length)return 'A'

  return parts
    .slice(0,2)
    .map(x=>x.charAt(0).toUpperCase())
    .join('')
}

function timestamp(value?:string){
  if(!value)return ''

  const date=new Date(value)

  if(Number.isNaN(date.getTime()))return ''

  const now=new Date()

  if(date.toDateString()===now.toDateString()){
    return date.toLocaleTimeString(
      'el-GR',
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    )
  }

  return date.toLocaleDateString(
    'el-GR',
    {
      day:'2-digit',
      month:'2-digit'
    }
  )
}

function fullTimestamp(value?:string){
  if(!value)return ''

  const date=new Date(value)

  if(Number.isNaN(date.getTime()))return ''

  return date.toLocaleString(
    'el-GR',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    }
  )
}

function statusLabel(status?:string){
  const labels:Record<string,string>={
    pending:'Νέο αίτημα',
    clarification:'Διευκρινίσεις',
    quoted:'Πρόταση κόστους',
    accepted:'Επιβεβαιωμένη',
    completed:'Ολοκληρωμένη',
    cancelled:'Ακυρωμένη'
  }

  return labels[String(status||'')]||String(status||'Αίτημα')
}

export default function ProfessionalMessages({
  bookings,
  token,
  user,
  unreadByBooking,
  unreadTotal,
  onRefresh,
  onUnreadRefresh,
  setToast
}:Props){

  const [selectedId,setSelectedId]=useState('')
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<Filter>('all')
  const [draft,setDraft]=useState('')
  const [sending,setSending]=useState(false)
  const [mobileThreadOpen,setMobileThreadOpen]=useState(false)
  const [isMobile,setIsMobile]=useState(false)

  const messagesRef=useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    const media=window.matchMedia('(max-width: 760px)')

    const sync=()=>setIsMobile(media.matches)

    sync()

    media.addEventListener?.('change',sync)

    return ()=>{
      media.removeEventListener?.('change',sync)
    }
  },[])

  const conversations=useMemo(()=>{

    return [...bookings]
      .filter((booking:any)=>
        (booking.messages||[]).length>0 ||
        Number(unreadByBooking[booking.id]||0)>0
      )
      .sort((a:any,b:any)=>{

        const unreadA=Number(unreadByBooking[a.id]||0)
        const unreadB=Number(unreadByBooking[b.id]||0)

        if(Boolean(unreadA)!==Boolean(unreadB)){
          return unreadB-unreadA
        }

        const lastA=(a.messages||[]).at(-1)
        const lastB=(b.messages||[]).at(-1)

        const timeA=new Date(
          lastA?.createdAt||
          a.updatedAt||
          a.createdAt||
          0
        ).getTime()

        const timeB=new Date(
          lastB?.createdAt||
          b.updatedAt||
          b.createdAt||
          0
        ).getTime()

        return timeB-timeA
      })

  },[bookings,unreadByBooking])

  const visibleConversations=useMemo(()=>{

    const needle=query.trim().toLocaleLowerCase('el-GR')

    return conversations.filter((booking:any)=>{

      const unread=Number(unreadByBooking[booking.id]||0)

      if(filter==='unread'&&!unread)return false

      if(!needle)return true

      const last=(booking.messages||[]).at(-1)

      const haystack=[
        booking.patientName,
        booking.service,
        booking.address,
        last?.text,
        last?.fromName
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('el-GR')

      return haystack.includes(needle)
    })

  },[
    conversations,
    query,
    filter,
    unreadByBooking
  ])

  const activeConversation=useMemo(()=>{

    return conversations.find(
      (booking:any)=>booking.id===selectedId
    )||null

  },[conversations,selectedId])

  useEffect(()=>{

    if(
      selectedId &&
      !conversations.some(
        (booking:any)=>booking.id===selectedId
      )
    ){
      setSelectedId('')
      setMobileThreadOpen(false)
    }

  },[conversations,selectedId])

  useEffect(()=>{

    if(!activeConversation)return

    requestAnimationFrame(()=>{

      const el=messagesRef.current

      if(el){
        el.scrollTop=el.scrollHeight
      }

    })

  },[
    activeConversation?.id,
    activeConversation?.messages?.length
  ])

  async function markRead(id:string){

    if(!Number(unreadByBooking[id]||0))return

    try{

      await api(
        '/bookings/'+id+'/messages/read',
        {
          method:'PATCH'
        },
        token
      )

      await onUnreadRefresh()

      window.dispatchEvent(
        new CustomEvent('meleo:communication-refresh')
      )

    }
    catch(error){
      console.error(
        'Could not mark professional conversation as read',
        error
      )
    }
  }

  async function openConversation(id:string){

    setSelectedId(id)
    setDraft('')

    if(isMobile){
      setMobileThreadOpen(true)
    }

    await markRead(id)
  }

  function closeMobileThread(){

    setMobileThreadOpen(false)

    requestAnimationFrame(()=>{

      const active=document.querySelector(
        `[data-professional-conversation="${selectedId}"]`
      ) as HTMLElement|null

      active?.focus?.()

    })
  }

  async function sendMessage(){

    const text=draft.trim()

    if(
      !text ||
      !activeConversation ||
      sending
    ){
      return
    }

    try{

      setSending(true)

      await api(
        '/bookings/'+activeConversation.id+'/message',
        {
          method:'POST',
          body:JSON.stringify({text})
        },
        token
      )

      setDraft('')

      await onRefresh()
      await onUnreadRefresh()

      window.dispatchEvent(
        new CustomEvent('meleo:communication-refresh')
      )

    }
    catch(error:any){

      setToast?.(
        error?.message||
        'Δεν ήταν δυνατή η αποστολή του μηνύματος.'
      )

    }
    finally{
      setSending(false)
    }
  }

  function handleComposerKeyDown(
    event:React.KeyboardEvent<HTMLTextAreaElement>
  ){

    if(
      event.key==='Enter' &&
      !event.shiftKey
    ){
      event.preventDefault()
      void sendMessage()
    }
  }

  const listVisible=
    !isMobile ||
    !mobileThreadOpen

  const threadVisible=
    !isMobile ||
    mobileThreadOpen

  return(
    <section
      className={
        'professional-messenger '+
        (mobileThreadOpen?'mobile-thread-open':'mobile-list-open')
      }
    >

      <aside
        className="professional-messenger-sidebar"
        aria-hidden={!listVisible}
      >

        <header className="professional-messenger-list-head">

          <div>
            <span>MELEO MESSAGES</span>
            <h2>Μηνύματα</h2>
          </div>

          {unreadTotal>0&&
            <strong
              className="professional-messenger-total-unread"
              aria-label={`${unreadTotal} αδιάβαστα μηνύματα`}
            >
              {unreadTotal}
            </strong>
          }

        </header>

        <div className="professional-messenger-tools">

          <label className="professional-messenger-search">

            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={query}
              onChange={event=>setQuery(event.target.value)}
              placeholder="Αναζήτηση συνομιλιών"
              aria-label="Αναζήτηση συνομιλιών"
            />

          </label>

          <div
            className="professional-messenger-filters"
            role="group"
            aria-label="Φίλτρο συνομιλιών"
          >

            <button
              type="button"
              className={filter==='all'?'active':''}
              onClick={()=>setFilter('all')}
            >
              Όλα
            </button>

            <button
              type="button"
              className={filter==='unread'?'active':''}
              onClick={()=>setFilter('unread')}
            >
              Μη αναγνωσμένα
              {unreadTotal>0&&<b>{unreadTotal}</b>}
            </button>

          </div>

        </div>

        <div className="professional-messenger-conversations">

          {visibleConversations.length===0
            ?
            <div className="professional-messenger-empty-list">

              <span aria-hidden="true">✉</span>

              <strong>
                {filter==='unread'
                  ? 'Δεν έχεις αδιάβαστα μηνύματα'
                  : query
                    ? 'Δεν βρέθηκε συνομιλία'
                    : 'Δεν υπάρχουν συνομιλίες ακόμη'}
              </strong>

              <p>
                {query
                  ? 'Δοκίμασε διαφορετικό όνομα ή υπηρεσία.'
                  : 'Τα μηνύματα από ασθενείς θα εμφανίζονται εδώ.'}
              </p>

            </div>
            :
            visibleConversations.map((booking:any)=>{

              const messages=booking.messages||[]
              const last=messages.at(-1)
              const unread=Number(
                unreadByBooking[booking.id]||0
              )

              const selected=
                activeConversation?.id===booking.id

              return(
                <button
                  type="button"
                  key={booking.id}
                  data-professional-conversation={booking.id}
                  className={
                    'professional-conversation-item '+
                    (selected?'selected ':'')+
                    (unread?'unread':'')
                  }
                  onClick={()=>
                    void openConversation(booking.id)
                  }
                >

                  <div className="professional-conversation-avatar">
                    {initials(
                      booking.patientName||
                      'Ασθενής'
                    )}
                  </div>

                  <div className="professional-conversation-copy">

                    <div className="professional-conversation-row">

                      <strong>
                        {booking.patientName||'Ασθενής'}
                      </strong>

                      <time>
                        {timestamp(last?.createdAt)}
                      </time>

                    </div>

                    <div className="professional-conversation-service">
                      {booking.service||'Αίτημα φροντίδας'}
                    </div>

                    <div className="professional-conversation-preview">

                      <span>
                        {last?.fromRole==='professional'
                          ? 'Εσύ: '
                          : ''}
                        {last?.text||
                         'Νέα συνομιλία'}
                      </span>

                      {unread>0&&
                        <b
                          aria-label={`${unread} αδιάβαστα`}
                        >
                          {unread}
                        </b>
                      }

                    </div>

                  </div>

                </button>
              )
            })
          }

        </div>

      </aside>


      <section
        className="professional-messenger-thread"
        aria-hidden={!threadVisible}
      >

        {activeConversation
          ?
          <>

            <header className="professional-thread-head">

              <button
                type="button"
                className="professional-thread-back"
                onClick={closeMobileThread}
                aria-label="Επιστροφή στις συνομιλίες"
              >
                ←
              </button>

              <div className="professional-conversation-avatar large">
                {initials(
                  activeConversation.patientName||
                  'Ασθενής'
                )}
              </div>

              <div className="professional-thread-person">

                <strong>
                  {activeConversation.patientName||
                   'Ασθενής'}
                </strong>

                <span>
                  {activeConversation.service||
                   'Αίτημα φροντίδας'}
                </span>

              </div>

              <span
                className={
                  'professional-thread-status status-'+
                  String(activeConversation.status||'unknown')
                }
              >
                {statusLabel(activeConversation.status)}
              </span>

            </header>


            <div className="professional-thread-context">

              <div>
                <span>Υπηρεσία</span>
                <strong>
                  {activeConversation.service||'—'}
                </strong>
              </div>

              <div>
                <span>Επίσκεψη</span>
                <strong>
                  {activeConversation.date||'—'}
                  {activeConversation.time
                    ? ' · '+activeConversation.time
                    : ''}
                </strong>
              </div>

              {(activeConversation.agreedPrice||
                activeConversation.proposedPrice||
                activeConversation.price)&&
                <div>
                  <span>Κόστος</span>
                  <strong>
                    {activeConversation.agreedPrice||
                     activeConversation.proposedPrice||
                     activeConversation.price}€
                  </strong>
                </div>
              }

            </div>


            <div
              className="professional-thread-messages"
              ref={messagesRef}
              aria-live="polite"
            >

              {(activeConversation.messages||[]).length===0
                ?
                <div className="professional-thread-empty">

                  <span aria-hidden="true">✉</span>

                  <strong>Ξεκίνα τη συνομιλία</strong>

                  <p>
                    Στείλε μήνυμα σχετικά με το συγκεκριμένο αίτημα.
                  </p>

                </div>
                :
                (activeConversation.messages||[]).map((message:any)=>{

                  const mine=
                    message.fromRole==='professional' ||
                    message.senderRole==='professional' ||
                    message.senderUserId===user?.id

                  return(
                    <div
                      key={message.id}
                      className={
                        'professional-message-line '+
                        (mine?'mine':'theirs')
                      }
                    >

                      <div className="professional-message-bubble">

                        {!mine&&
                          <b>
                            {message.fromName||
                             message.senderName||
                             activeConversation.patientName||
                             'Ασθενής'}
                          </b>
                        }

                        <p>
                          {message.text||
                           message.body||
                           ''}
                        </p>

                        <time>
                          {fullTimestamp(message.createdAt)}
                        </time>

                      </div>

                    </div>
                  )
                })
              }

            </div>


            {activeConversation.status!=='cancelled'&&
              <footer className="professional-thread-composer">

                <textarea
                  value={draft}
                  onChange={event=>setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Γράψε μήνυμα…"
                  rows={1}
                  aria-label="Νέο μήνυμα"
                />

                <button
                  type="button"
                  disabled={
                    sending||
                    !draft.trim()
                  }
                  onClick={()=>
                    void sendMessage()
                  }
                  aria-label="Αποστολή μηνύματος"
                >
                  {sending?'…':'➜'}
                </button>

              </footer>
            }

          </>
          :
          <div className="professional-thread-placeholder">

            <div className="professional-thread-placeholder-mark">
              M
            </div>

            <strong>
              Επίλεξε μια συνομιλία
            </strong>

            <p>
              Τα μηνύματα και οι πληροφορίες του αιτήματος
              θα εμφανιστούν εδώ.
            </p>

          </div>
        }

      </section>

    </section>
  )
}