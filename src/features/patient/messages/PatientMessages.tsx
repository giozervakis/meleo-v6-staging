import React, {
  useMemo,
  useRef,
  useState,
  useEffect
} from 'react'

import './patient-messages.css'

type Props = {
  bookings:any[]
  unreadByBooking:Record<string,number>
  unreadTotal:number
  activeId:string
  draft:string
  sending:boolean
  user:any

  setDraft:(value:string)=>void
  openConversation:(id:string)=>void
  sendMessage:()=>void

  initials:(name:string)=>string
  statusLabel:(status:string)=>string
  money:(value:number)=>string
}

type InboxFilter = 'all' | 'unread'

function lastMessageOf(booking:any){
  return (booking.messages||[]).at(-1)
}

function lastActivityOf(booking:any){
  const last=lastMessageOf(booking)

  return new Date(
    last?.createdAt ||
    booking.updatedAt ||
    booking.createdAt ||
    0
  ).getTime()
}

function messageTime(value?:string){
  if(!value)return ''

  const date=new Date(value)
  const today=new Date()

  if(
    date.getFullYear()===today.getFullYear() &&
    date.getMonth()===today.getMonth() &&
    date.getDate()===today.getDate()
  ){
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

export default function PatientMessages({
  bookings,
  unreadByBooking,
  unreadTotal,
  activeId,
  draft,
  sending,
  user,
  setDraft,
  openConversation,
  sendMessage,
  initials,
  statusLabel,
  money
}:Props){

  const [filter,setFilter]=useState<InboxFilter>('all')
  const [query,setQuery]=useState('')
  const [mobileThreadOpen,setMobileThreadOpen]=useState(false)
  const [isMobileMessenger,setIsMobileMessenger]=useState(
    ()=>typeof window!=='undefined'
      ? window.matchMedia('(max-width: 700px)').matches
      : false
  )

  useEffect(()=>{

    if(typeof window==='undefined'){
      return
    }

    const media=
      window.matchMedia('(max-width: 700px)')

    const sync=()=>{
      setIsMobileMessenger(media.matches)
    }

    sync()

    media.addEventListener?.(
      'change',
      sync
    )

    return ()=>{
      media.removeEventListener?.(
        'change',
        sync
      )
    }

  },[])

  const messagesRef=useRef<HTMLDivElement|null>(null)

  const conversations=useMemo(()=>{

    const q=query.trim().toLocaleLowerCase('el-GR')

    return [...bookings]
      .filter((booking:any)=>{
        const messages=booking.messages||[]
        const unread=Number(unreadByBooking[booking.id]||0)

        if(messages.length===0 && unread===0){
          return false
        }

        if(filter==='unread' && unread===0){
          return false
        }

        if(!q)return true

        const last=lastMessageOf(booking)

        const haystack=[
          booking.professionalName,
          booking.service,
          booking.specialty,
          last?.text,
          last?.body
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('el-GR')

        return haystack.includes(q)
      })
      .sort((a:any,b:any)=>{

        const aUnread=Number(unreadByBooking[a.id]||0)>0
        const bUnread=Number(unreadByBooking[b.id]||0)>0

        /*
         * Messenger/Viber behaviour:
         * unread conversations first.
         */
        if(aUnread!==bUnread){
          return aUnread ? -1 : 1
        }

        /*
         * Inside each group:
         * newest activity first.
         */
        return lastActivityOf(b)-lastActivityOf(a)
      })

  },[
    bookings,
    unreadByBooking,
    filter,
    query
  ])

  const activeConversation=
    bookings.find((b:any)=>b.id===activeId) ||
    conversations[0] ||
    null

  useEffect(()=>{

    const el=messagesRef.current

    if(!el)return

    requestAnimationFrame(()=>{
      el.scrollTop=el.scrollHeight
    })

  },[
    activeConversation?.id,
    activeConversation?.messages?.length
  ])

  function selectConversation(id:string){

    openConversation(id)
    setMobileThreadOpen(true)

  }

  function closeMobileThread(){
    setMobileThreadOpen(false)
  }

  return (
    <section
      className={
        'meleo-messenger '+
        (
          isMobileMessenger&&mobileThreadOpen
            ? 'mobile-thread-open'
            : ''
        )+
        (
          isMobileMessenger
            ? ' mobile-layout'
            : ' desktop-layout'
        )
      }
    >

      <aside
        className="meleo-messenger-sidebar"
        aria-hidden={
          isMobileMessenger&&mobileThreadOpen
        }
        style={
          isMobileMessenger&&mobileThreadOpen
            ? {display:'none'}
            : undefined
        }
      >

        <header className="meleo-messenger-sidebar-head">

          <div>
            <small>MELEO COMMUNICATION</small>
            <h2>Μηνύματα</h2>
          </div>

          {unreadTotal>0&&
            <span className="meleo-messenger-total-unread">
              {unreadTotal>99?'99+':unreadTotal}
            </span>
          }

        </header>


        <div className="meleo-messenger-search">

          <span>⌕</span>

          <input
            type="search"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="Αναζήτηση συνομιλιών…"
            aria-label="Αναζήτηση συνομιλιών"
          />

        </div>


        <div className="meleo-messenger-filters" role="group" aria-label="Φίλτρα συνομιλιών">

          <button
            className={filter==='all'?'active':''}
            aria-pressed={filter==='all'}
            onClick={()=>setFilter('all')}
          >
            Όλα
          </button>

          <button
            className={filter==='unread'?'active':''}
            aria-pressed={filter==='unread'}
            onClick={()=>setFilter('unread')}
          >
            Μη αναγνωσμένα

            {unreadTotal>0&&
              <b>
                {unreadTotal>99?'99+':unreadTotal}
              </b>
            }
          </button>

        </div>


        <div className="meleo-conversation-list" aria-live="polite">

          {conversations.length===0
            ?
            <div className="meleo-conversation-empty">
              <span>◇</span>

              <b>
                {filter==='unread'
                  ? 'Δεν έχεις μη αναγνωσμένα'
                  : 'Δεν υπάρχουν συνομιλίες'
                }
              </b>

              <p>
                {query
                  ? 'Δεν βρέθηκε συνομιλία που να ταιριάζει στην αναζήτηση.'
                  : 'Οι συνομιλίες σου με επαγγελματίες θα εμφανίζονται εδώ.'
                }
              </p>
            </div>

            :
            conversations.map((booking:any)=>{

              const last=lastMessageOf(booking)

              const unread=
                Number(unreadByBooking[booking.id]||0)

              const isUnread=unread>0

              const active=
                activeConversation?.id===booking.id

              return(
                <button
                  key={booking.id}
                  className={[
                    'meleo-conversation-row',
                    active?'active':'',
                    isUnread?'unread':''
                  ].filter(Boolean).join(' ')}
                  onClick={()=>selectConversation(booking.id)}
                >

                  <div className="meleo-conversation-avatar">
                    {initials(
                      booking.professionalName||
                      'Επαγγελματίας'
                    )}

                    {isUnread&&
                      <span className="meleo-unread-dot"/>
                    }
                  </div>


                  <div className="meleo-conversation-content">

                    <div className="meleo-conversation-title">

                      <strong>
                        {booking.professionalName||
                         'Επαγγελματίας MELEO'}
                      </strong>

                      <time>
                        {messageTime(last?.createdAt)}
                      </time>

                    </div>


                    <span className="meleo-conversation-service">
                      {booking.service||
                       booking.specialty||
                       'Αίτημα επίσκεψης'}
                    </span>


                    <div className="meleo-conversation-preview">

                      <p>
                        {last?.text||
                         last?.body||
                         'Άνοιξε τη συνομιλία'}
                      </p>

                      {isUnread&&
                        <span className="meleo-unread-count">
                          {unread>99?'99+':unread}
                        </span>
                      }

                    </div>

                  </div>

                </button>
              )
            })
          }

        </div>

      </aside>


      <main
        className="meleo-thread"
        aria-hidden={
          isMobileMessenger&&!mobileThreadOpen
        }
        style={
          isMobileMessenger&&!mobileThreadOpen
            ? {display:'none'}
            : undefined
        }
      >

        {activeConversation
          ?
          <>

            <header className="meleo-thread-head">

              <button
                className="meleo-thread-back"
                onClick={closeMobileThread}
                aria-label="Πίσω στις συνομιλίες"
              >
                ←
              </button>


              <div className="meleo-thread-avatar">
                {initials(
                  activeConversation.professionalName||
                  'Επαγγελματίας'
                )}
              </div>


              <div className="meleo-thread-person">

                <strong>
                  {activeConversation.professionalName||
                   'Επαγγελματίας MELEO'}
                </strong>

                <span>
                  {activeConversation.service||
                   activeConversation.specialty||
                   'Επαγγελματίας MELEO'}
                </span>

              </div>


              <span
                className={
                  'status '+
                  activeConversation.status
                }
              >
                {statusLabel(activeConversation.status)}
              </span>

            </header>


            <div className="meleo-thread-context">

              <div className="meleo-context-chip">

                <span className="meleo-context-icon">
                  ✦
                </span>

                <span className="meleo-context-main">
                  <b>
                    {activeConversation.service||
                     'Αίτημα επίσκεψης'}
                  </b>

                  <small>
                    {activeConversation.date||'—'}
                    {' · '}
                    {activeConversation.time||'—'}
                  </small>
                </span>

                <strong>
                  {activeConversation.agreedPrice
                    ? money(activeConversation.agreedPrice)
                    : activeConversation.proposedPrice
                      ? money(activeConversation.proposedPrice)
                      : activeConversation.price
                        ? `Από ${money(activeConversation.price)}`
                        : 'Σε αναμονή'
                  }
                </strong>

              </div>

            </div>


            <div
              className="meleo-thread-messages"
              ref={messagesRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Μηνύματα συνομιλίας"
            >

              {(activeConversation.messages||[]).length===0
                ?
                <div className="meleo-thread-empty">

                  <span>◇</span>

                  <h3>Ξεκίνα τη συνομιλία</h3>

                  <p>
                    Στείλε μήνυμα στον επαγγελματία
                    σχετικά με το αίτημά σου.
                  </p>

                </div>

                :
                (activeConversation.messages||[])
                  .map((message:any)=>{

                    const role=
                      String(
                        message.fromRole||
                        message.senderRole||
                        ''
                      ).toLowerCase()

                    const mine=
                      role==='patient' ||
                      (
                        message.senderUserId &&
                        message.senderUserId===user.id
                      )

                    return(
                      <div
                        key={message.id}
                        className={
                          'meleo-message '+(mine?'mine':'theirs')
                        }
                      >

                        <div className="meleo-message-bubble">

                          {!mine&&
                            <b>
                              {message.fromName||
                               message.senderName||
                               activeConversation.professionalName||
                               'Επαγγελματίας'}
                            </b>
                          }

                          <p>
                            {message.text||
                             message.body||
                             ''}
                          </p>

                          <time>
                            {message.createdAt
                              ? new Date(
                                  message.createdAt
                                ).toLocaleTimeString(
                                  'el-GR',
                                  {
                                    hour:'2-digit',
                                    minute:'2-digit'
                                  }
                                )
                              : ''
                            }

                            {mine&&
                              <span
                                className="meleo-message-seen"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            }
                          </time>

                        </div>

                      </div>
                    )
                  })
              }

            </div>


            <footer className="meleo-thread-composer">

              <div className="meleo-thread-input">

                <textarea
                  aria-label="Γράψε μήνυμα"
                  value={draft}
                  onChange={e=>setDraft(e.target.value)}
                  placeholder="Γράψε ένα μήνυμα…"
                  maxLength={1500}
                  onKeyDown={e=>{

                    if(
                      e.key==='Enter' &&
                      !e.shiftKey
                    ){
                      e.preventDefault()
                      sendMessage()
                    }

                  }}
                />

                <button
                  disabled={!draft.trim()||sending}
                  aria-busy={sending}
                  onClick={sendMessage}
                  aria-label="Αποστολή μηνύματος"
                >
                  {sending?'…':'➤'}
                </button>

              </div>

              <small>
                Enter για αποστολή · Shift + Enter για νέα γραμμή
              </small>

            </footer>

          </>

          :

          <div className="meleo-thread-no-selection">

            <span>◇</span>

            <h3>Τα μηνύματά σου</h3>

            <p>
              Επίλεξε μια συνομιλία για να ανοίξει ο διάλογος.
            </p>

          </div>
        }

      </main>

    </section>
  )
}