import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {api} from '../../../lib/api'
import {useTranslation} from 'react-i18next'

import './professional-notifications.css'


type NotificationItem={
  id:string
  type?:string
  title?:string
  body?:string
  message?:string
  text?:string
  read?:boolean
  readAt?:string|null
  createdAt?:string
  created_at?:string
}


type Props={
  token:string
  setToast:(message:string)=>void
}


function createdAt(item:NotificationItem){

  return String(
    item.createdAt ||
    item.created_at ||
    ''
  )
}


function notificationText(item:NotificationItem){

  return String(
    item.body ||
    item.message ||
    item.text ||
    ''
  )
}


function isUnread(item:NotificationItem){

  if(
    typeof item.read === 'boolean'
  ){
    return !item.read
  }

  return !item.readAt
}


function dateLabel(
  value:string,
  locale='el-GR'
){

  if(!value){
    return ''
  }

  const date=
    new Date(value)

  if(Number.isNaN(date.getTime())){
    return ''
  }

  return date.toLocaleString(
    locale,
    {
      day:'2-digit',
      month:'short',
      hour:'2-digit',
      minute:'2-digit'
    }
  )
}


function typeLabel(
  type:string|undefined,
  t:(key:string)=>string
){

  const value=
    String(type||'').toLowerCase()

  if(value.includes('support')){
    return t(
      'proNotifications.types.support'
    )
  }

  if(
    value.includes('booking') ||
    value.includes('request')
  ){
    return t(
      'proNotifications.types.request'
    )
  }

  if(
    value.includes('review') ||
    value.includes('rating')
  ){
    return t(
      'proNotifications.types.review'
    )
  }

  if(
    value.includes('verification')
  ){
    return t(
      'proNotifications.types.verification'
    )
  }

  if(
    value.includes('subscription') ||
    value.includes('billing') ||
    value.includes('payment')
  ){
    return t(
      'proNotifications.types.subscription'
    )
  }

  return 'MELEO'
}


export default function ProfessionalNotifications({
  token,
  setToast
}:Props){

  const {t,i18n}=useTranslation()

  const locale=
    i18n.resolvedLanguage==='en'
      ? 'en-GB'
      : 'el-GR'

  const [items,setItems]=
    useState<NotificationItem[]>([])

  const [loading,setLoading]=
    useState(true)

  const [busy,setBusy]=
    useState<string|null>(null)

  const [filter,setFilter]=
    useState<'all'|'unread'>('all')

  const [query,setQuery]=
    useState('')

  const [error,setError]=
    useState('')


  const load=
    useCallback(
      async()=>{

        setLoading(true)

        try{

          const response=
            await api(
              '/notifications',
              {},
              token
            )

          const next=
            Array.isArray(response)
              ? response
              : Array.isArray(response?.items)
                ? response.items
                : []

          setItems(next)
          setError('')
        }
        catch(e:any){

          setError(
            e?.message ||
            t(
              'proNotifications.errors.load'
            )
          )
        }
        finally{
          setLoading(false)
        }
      },
      [token,t]
    )


  useEffect(()=>{
    load()
  },[load])


  const unreadCount=
    useMemo(
      ()=>
        items.filter(
          isUnread
        ).length,
      [items]
    )


  const visible=
    useMemo(
      ()=>{

        const q=
          query.trim().toLocaleLowerCase(locale)

        return [...items]
          .filter(
            item=>
              filter==='all' ||
              isUnread(item)
          )
          .filter(
            item=>{

              if(!q){
                return true
              }

              return (
                String(item.title||'')+
                ' '+
                notificationText(item)+
                ' '+
                String(item.type||'')
              )
                .toLocaleLowerCase(locale)
                .includes(q)
            }
          )
          .sort(
            (a,b)=>{

              const unreadDifference=
                Number(isUnread(b))-
                Number(isUnread(a))

              if(unreadDifference){
                return unreadDifference
              }

              return (
                new Date(createdAt(b)).getTime() -
                new Date(createdAt(a)).getTime()
              )
            }
          )
      },
      [
        items,
        filter,
        query,
        locale
      ]
    )


  async function markRead(
    item:NotificationItem
  ){

    if(
      !isUnread(item) ||
      busy
    ){
      return
    }

    setBusy(item.id)

    try{

      await api(
        `/notifications/${encodeURIComponent(item.id)}/read`,
        {
          method:'PATCH'
        },
        token
      )

      const now=
        new Date().toISOString()

      setItems(
        current=>
          current.map(
            x=>
              x.id===item.id
                ? {
                    ...x,
                    read:true,
                    readAt:now
                  }
                : x
          )
      )
    }
    catch(e:any){

      setToast(
        e?.message ||
        t(
          'proNotifications.errors.markRead'
        )
      )
    }
    finally{
      setBusy(null)
    }
  }


  async function markAllRead(){

    if(
      unreadCount===0 ||
      busy
    ){
      return
    }

    setBusy('all')

    try{

      await api(
        '/notifications/read-all',
        {
          method:'PATCH'
        },
        token
      )

      const now=
        new Date().toISOString()

      setItems(
        current=>
          current.map(
            item=>({
              ...item,
              read:true,
              readAt:
                item.readAt ||
                now
            })
          )
      )

      setToast(
        t(
          'proNotifications.toast.allRead'
        )
      )
    }
    catch(e:any){

      setToast(
        e?.message ||
        t(
          'proNotifications.errors.markAllRead'
        )
      )
    }
    finally{
      setBusy(null)
    }
  }


  return (
    <section className="pro-notifications">


      <header className="pro-notifications-hero">

        <div>

          <span>
            {t(
              'proNotifications.hero.eyebrow'
            )}
          </span>

          <h2>
            {t(
              'proNotifications.hero.title'
            )}
          </h2>

          <p>
            {t(
              'proNotifications.hero.text'
            )}
          </p>

        </div>


        <aside>

          <small>
            {t(
              'proNotifications.hero.unread'
            )}
          </small>

          <strong>
            {unreadCount}
          </strong>

          <span>
            {t(
              'proNotifications.hero.total',
              {
                count:items.length
              }
            )}
          </span>

        </aside>

      </header>


      <div className="pro-notifications-toolbar">

        <div className="pro-notifications-filters">

          <button
            type="button"
            className={
              filter==='all'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('all')}
          >
            {t(
              'proNotifications.filters.all'
            )}
          </button>

          <button
            type="button"
            className={
              filter==='unread'
                ? 'active'
                : ''
            }
            onClick={()=>setFilter('unread')}
          >
            {t(
              'proNotifications.filters.unread'
            )}

            {unreadCount>0&&
              <b>
                {unreadCount}
              </b>
            }
          </button>

        </div>


        <div className="pro-notifications-actions">

          <input
            value={query}
            onChange={
              event=>
                setQuery(
                  event.target.value
                )
            }
            placeholder={t(
              'proNotifications.search.placeholder'
            )}
          />

          <button
            type="button"
            disabled={
              unreadCount===0 ||
              Boolean(busy)
            }
            onClick={markAllRead}
          >
            ✓ {t(
              'proNotifications.actions.markAllRead'
            )}
          </button>

        </div>

      </div>


      {error&&
        <div className="pro-notifications-error">
          {error}
        </div>
      }


      {loading

        ? <div className="pro-notifications-empty">
            {t(
              'proNotifications.loading'
            )}
          </div>

        : visible.length===0

          ? <div className="pro-notifications-empty">

              <span>
                ✓
              </span>

              <strong>
                {filter==='unread'
                  ? t(
                      'proNotifications.empty.unread'
                    )
                  : t(
                      'proNotifications.empty.all'
                    )}
              </strong>

              <p>
                {t(
                  'proNotifications.empty.text'
                )}
              </p>

            </div>

          : <div className="pro-notifications-list">

              {visible.map(
                item=>{

                  const unread=
                    isUnread(item)

                  return (
                    <article
                      key={item.id}
                      className={
                        unread
                          ? 'unread'
                          : ''
                      }
                    >

                      <div className="pro-notification-marker">
                        <i/>
                      </div>


                      <div className="pro-notification-content">

                        <div className="pro-notification-meta">

                          <span>
                            {typeLabel(
                              item.type,
                              t
                            )}
                          </span>

                          <time>
                            {dateLabel(
                              createdAt(item),
                              locale
                            )}
                          </time>

                        </div>

                        <strong>
                          {item.title ||
                           t(
                             'proNotifications.fallbackTitle'
                           )}
                        </strong>

                        {notificationText(item)&&
                          <p>
                            {notificationText(item)}
                          </p>
                        }

                      </div>


                      <div className="pro-notification-state">

                        {unread
                          ? <button
                              type="button"
                              disabled={
                                busy===item.id
                              }
                              onClick={
                                ()=>markRead(item)
                              }
                            >
                              {busy===item.id
                                ? '…'
                                : t(
                                    'proNotifications.actions.markRead'
                                  )}
                            </button>

                          : <span>
                              ✓ {t(
                                'proNotifications.actions.read'
                              )}
                            </span>
                        }

                      </div>

                    </article>
                  )
                }
              )}

            </div>
      }

    </section>
  )
}