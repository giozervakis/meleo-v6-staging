import React, {
  useEffect,
  useMemo,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { catalogLabel } from '../../domain/catalog-i18n'
import './search-rc3d.css'

function SearchPage({
  pros,
  search,
  setSearch,
  loadPros,
  openPro,
  favorites,
  toggleFav,
  SearchBox,
  ProCard
}:any){
  const {t,i18n}=useTranslation()

  const [sort,setSort]=useState('recommended')
  const [trustOnly,setTrustOnly]=useState(false)
  const [availableOnly,setAvailableOnly]=useState(false)
  const [nearOnly,setNearOnly]=useState(false)
  const [premiumOnly,setPremiumOnly]=useState(false)

  function scrollToResults(){
    window.setTimeout(()=>{
      const el=document.getElementById('meleo-search-results')
      if(!el)return
      const top=
        el.getBoundingClientRect().top+
        window.scrollY-
        92
      window.scrollTo({
        top:Math.max(0,top),
        behavior:'smooth'
      })
      el.focus({preventScroll:true})
    },120)
  }

  useEffect(()=>{
    try{
      if(sessionStorage.getItem('meleo.scrollSearchResults')==='1'){
        sessionStorage.removeItem('meleo.scrollSearchResults')
        scrollToResults()
      }
    }catch{}
  },[])

  const filtered=useMemo(()=>{
    let items=[...pros]

    if(trustOnly){
      items=items.filter((p:any)=>p.trust?.eligible)
    }

    if(availableOnly){
      items=items.filter((p:any)=>{
        const text=String(p.available||'').toLowerCase()
        return (
          text.includes('σήμερα') ||
          text.includes('άμεσα') ||
          text.includes('διαθέσ') ||
          text.includes('available')
        )
      })
    }

    if(nearOnly){
      items=items.filter(
        (p:any)=>
          p.distance!==undefined &&
          p.distance!==null &&
          Number.isFinite(Number(p.distance)) &&
          Number(p.distance)<=10
      )
    }

    if(premiumOnly){
      items=items.filter(
        (p:any)=>p.subscriptionPlan==='premium'
      )
    }

    return items
  },[
    pros,
    trustOnly,
    availableOnly,
    nearOnly,
    premiumOnly
  ])

  const sorted=useMemo(()=>{
    const items=[...filtered]

    if(sort==='price'){
      return items.sort(
        (a:any,b:any)=>
          (Number(a.price)||0)-
          (Number(b.price)||0)
      )
    }

    if(sort==='rating'){
      return items.sort(
        (a:any,b:any)=>
          (Number(b.rating)||0)-
          (Number(a.rating)||0)
      )
    }

    if(sort==='distance'){
      return items.sort((a:any,b:any)=>{
        const ad=
          Number.isFinite(Number(a.distance))
            ? Number(a.distance)
            : Number.POSITIVE_INFINITY
        const bd=
          Number.isFinite(Number(b.distance))
            ? Number(b.distance)
            : Number.POSITIVE_INFINITY
        return ad-bd
      })
    }

    return items
  },[filtered,sort])

  const activeFilters=[
    trustOnly&&'MELEO Trust',
    availableOnly&&t('searchPage.availableNow'),
    nearOnly&&t('searchPage.within10'),
    premiumOnly&&'Premium'
  ].filter(Boolean)

  const hasSearchContext=!!(
    search.specialty ||
    search.service ||
    search.locationQuery ||
    search.locationLabel
  )

  const topMatches=
    sorted.filter((p:any)=>p.smartMatch?.rank<=3).length

  function resetDiscoveryFilters(){
    setTrustOnly(false)
    setAvailableOnly(false)
    setNearOnly(false)
    setPremiumOnly(false)
    setSort('recommended')
  }

  return (
    <section className="page discovery-page rc3d-search-page" aria-labelledby="meleo-search-title">
      <div className="container">

        <div className="discovery-page-hero">
          <div>
            <span className="discovery-page-kicker">
              {t('searchPage.kicker')}
            </span>

            <h1 id="meleo-search-title">
              {t('searchPage.title1')}
              <br/>
              <em>{t('searchPage.title2')}</em>
            </h1>

            <p>{t('searchPage.intro')}</p>
          </div>

          <div className="discovery-page-hero-badge">
            <span>✦</span>
            <div>
              <small>SMART MATCH</small>
              <strong>{t('searchPage.smartTitle')}</strong>
              <p>{t('searchPage.smartText')}</p>
            </div>
          </div>
        </div>

        <div className="discovery-search-shell" aria-label={t('search.search')}>
          <SearchBox
            search={search}
            setSearch={setSearch}
            onSearch={async (criteria:any)=>{
              setSearch(criteria)
              await loadPros(criteria)
              scrollToResults()
            }}
          />
        </div>

        {hasSearchContext&&
          <div className="discovery-context-strip">
            <div className="discovery-context-copy">
              <small>{t('searchPage.currentSearch')}</small>
              <div>
                {search.specialty&&
                  <span>{catalogLabel(search.specialty,i18n.language)}</span>
                }
                {search.service&&
                  <span>{catalogLabel(search.service,i18n.language)}</span>
                }
                {(search.locationLabel||search.locationQuery)&&
                  <span>
                    ⌖{' '}
                    {search.locationLabel||search.locationQuery}
                  </span>
                }
              </div>
            </div>

            <button
              type="button"
              onClick={()=>{
                const next={
                  specialty:'',
                  service:'',
                  locationQuery:'',
                  locationLabel:'',
                  lat:'',
                  lon:''
                }
                setSearch(next)
                loadPros(next)
                resetDiscoveryFilters()
              }}
            >
              {t('searchPage.clear')}
            </button>
          </div>
        }

        <div
          id="meleo-search-results"
          className="discovery-toolbar"
          tabIndex={-1}
          aria-live="polite"
          aria-label={t('searchPage.results')}
        >
          <div className="discovery-results-summary">
            <small>{t('searchPage.results')}</small>
            <strong>{sorted.length}</strong>
            <span>
              {sorted.length===1
                ? t('searchPage.professional')
                : t('searchPage.professionals')
              }
            </span>
            {topMatches>0&&
              <b>✦ {topMatches} Smart Match</b>
            }
          </div>

          <div className="discovery-sort">
            <label>
              {t('searchPage.sort')}
              <select
                value={sort}
                onChange={e=>setSort(e.target.value)}
              >
                <option value="recommended">
                  {t('searchPage.recommended')}
                </option>
                <option value="rating">
                  {t('searchPage.rating')}
                </option>
                <option value="distance">
                  {t('searchPage.distance')}
                </option>
                <option value="price">
                  {t('searchPage.price')}
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="discovery-filter-bar" aria-label={t('searchPage.filters')}>
          <div className="discovery-filter-label">
            <span>☷</span>
            <div>
              <b>{t('searchPage.filters')}</b>
              <small>{t('searchPage.narrow')}</small>
            </div>
          </div>

          <button
            type="button"
            aria-pressed={trustOnly}
            className={trustOnly?'active':''}
            onClick={()=>setTrustOnly(v=>!v)}
          >
            ✦ MELEO Trust
          </button>

          <button
            type="button"
            aria-pressed={availableOnly}
            className={availableOnly?'active':''}
            onClick={()=>setAvailableOnly(v=>!v)}
          >
            ⚡ {t('searchPage.availableNow')}
          </button>

          <button
            type="button"
            aria-pressed={nearOnly}
            className={nearOnly?'active':''}
            onClick={()=>setNearOnly(v=>!v)}
          >
            ⌖ {t('searchPage.within10')}
          </button>

          <button
            type="button"
            aria-pressed={premiumOnly}
            className={
              premiumOnly
                ? 'active premium-filter'
                : 'premium-filter'
            }
            onClick={()=>setPremiumOnly(v=>!v)}
          >
            ◆ Premium
          </button>

          {activeFilters.length>0&&
            <button
              type="button"
              className="discovery-reset-filters"
              onClick={resetDiscoveryFilters}
            >
              × {t('searchPage.clearFilters')}
            </button>
          }
        </div>

        {activeFilters.length>0&&
          <div className="discovery-active-filters">
            <span>{t('searchPage.activeFilters')}</span>
            {activeFilters.map((x:any)=>
              <b key={x}>{x}</b>
            )}
          </div>
        }

        {sorted.length
          ? <>
              {sort==='recommended'&&topMatches>0&&
                <div className="discovery-ranking-note">
                  <span>✦</span>
                  <div>
                    <b>{t('searchPage.rankingTitle')}</b>
                    <p>{t('searchPage.rankingText')}</p>
                  </div>
                </div>
              }

              <div className="discovery-results">
                {sorted.map((p:any)=>
                  <ProCard
                    key={p.id}
                    p={p}
                    open={()=>openPro(p)}
                    favorite={favorites.includes(p.id)}
                    toggle={()=>toggleFav(p.id)}
                  />
                )}
              </div>
            </>
          : <div className="discovery-empty">
              <div className="discovery-empty-mark">⌕</div>
              <small>{t('searchPage.noResults')}</small>
              <h2>{t('searchPage.noResultsTitle')}</h2>
              <p>{t('searchPage.noResultsText')}</p>

              <div className="discovery-empty-actions">
                {activeFilters.length>0&&
                  <button
                    className="btn btn-dark"
                    onClick={resetDiscoveryFilters}
                  >
                    {t('searchPage.clearFilters')}
                  </button>
                }

                <button
                  className="btn btn-outline"
                  onClick={()=>{
                    const next={...search,service:''}
                    setSearch(next)
                    loadPros(next)
                    resetDiscoveryFilters()
                  }}
                >
                  {t('searchPage.allServices')}
                </button>
              </div>
            </div>
        }

        <div className="discovery-explainer">
          <span>ⓘ</span>
          <p>{t('searchPage.disclaimer')}</p>
        </div>
      </div>
    </section>
  )
}

export default SearchPage
