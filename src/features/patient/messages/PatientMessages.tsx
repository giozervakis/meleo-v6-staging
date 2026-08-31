import React, {
  useMemo,
  useRef,
  useState,
  useEffect
} from 'react'

import { useTranslation } from 'react-i18next'

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

function messageTime(
  value:string|undefined,
  locale:string
){
  if(!value)return ''

  const date=new Date(value)
  const today=new Date()

  if(
    date.getFullYear()===today.getFullYear() &&
    date.getMonth()===today.getMonth() &&
    date.getDate()===today.getDate()
  ){
    return date.toLocaleTimeString(
      locale,
      {
        hour:'2-digit',
        minute:'2-digit'
      }
    )
  }

  return date.toLocaleDateString(
    locale,
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

  const {t,i18n}=useTranslation()

  const locale=
    i18n.resolvedLanguage==='en'
      ? 'en-GB'
      : 'el-GR'

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

    const q=
      query
        .trim()
        .toLocaleLowerCase(locale)

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
          .toLocaleLowerCase(locale)

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
    query,
    locale
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
            <h2>{t('patientMessages.title')}</h2>
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
            placeholder={t('patientMessages.search.placeholder')}
            aria-label={t('patientMessages.search.aria')}
          />

        </div>


        <div className="meleo-messenger-filters" role="group" aria-label={t('patientMessages.filters.aria')}>

          <button
            className={filter==='all'?'active':''}
            aria-pressed={filter==='all'}
            onClick={()=>setFilter('all')}
          >
            {t('patientMessages.filters.all')}
          </button>

          <button
            className={filter==='unread'?'active':''}
            aria-pressed={filter==='unread'}
            onClick={()=>setFilter('unread')}
          >
            {t('patientMessages.filters.unread')}

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
                  ? t('patientMessages.empty.noUnread')
                  : t('patientMessages.empty.noConversations')
                }
              </b>

              <p>
                {query
                  ? t('patientMessages.empty.search')
                  : t('patientMessages.empty.default')
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
                      t('patientMessages.fallback.professional')
                    )}

                    {isUnread&&
                      <span className="meleo-unread-dot"/>
                    }
                  </div>


                  <div className="meleo-conversation-content">

                    <div className="meleo-conversation-title">

                      <strong>
                        {booking.professionalName||
                         t('patientMessages.fallback.meleoProfessional')}
                      </strong>

                      <time>
                        {messageTime(last?.createdAt,locale)}
                      </time>

                    </div>


                    <span className="meleo-conversation-service">
                      {booking.service||
                       booking.specialty||
                       t('patientMessages.fallback.visitRequest')}
                    </span>


                    <div className="meleo-conversation-preview">

                      <p>
                        {last?.text||
                         last?.body||
                         t('patientMessages.fallback.openConversation')}
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
                aria-label={t('patientMessages.thread.back')}
              >
                ←
              </button>


              <div className="meleo-thread-avatar">
                {initials(
                  activeConversation.professionalName||
                  t('patientMessages.fallback.professional')
                )}
              </div>


              <div className="meleo-thread-person">

                <strong>
                  {activeConversation.professionalName||
                   t('patientMessages.fallback.meleoProfessional')}
                </strong>

                <span>
                  {activeConversation.service||
                   activeConversation.specialty||
                   t('patientMessages.fallback.meleoProfessional')}
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
                     t('patientMessages.fallback.visitRequest')}
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
                        ? t('patientMessages.context.fromPrice',{
                            price:money(activeConversation.price)
                          })
                        : t('patientMessages.context.pending')
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
              aria-label={t('patientMessages.thread.messagesAria')}
            >

              {(activeConversation.messages||[]).length===0
                ?
                <div className="meleo-thread-empty">

                  <span>◇</span>

                  <h3>{t('patientMessages.thread.emptyTitle')}</h3>

                  <p>
                    {t('patientMessages.thread.emptyText')}
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
                               t('patientMessages.fallback.professional')}
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
                                  locale,
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
                  aria-label={t('patientMessages.composer.aria')}
                  value={draft}
                  onChange={e=>setDraft(e.target.value)}
                  placeholder={t('patientMessages.composer.placeholder')}
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
                  aria-label={t('patientMessages.composer.send')}
                >
                  {sending?'…':'➤'}
                </button>

              </div>

              <small>
                {t('patientMessages.composer.hint')}
              </small>

            </footer>

          </>

          :

          <div className="meleo-thread-no-selection">

            <span>◇</span>

            <h3>{t('patientMessages.noSelection.title')}</h3>

            <p>
              {t('patientMessages.noSelection.text')}
            </p>

          </div>
        }

      </main>

    </section>
  )
}