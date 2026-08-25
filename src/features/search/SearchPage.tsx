import React, {
  useMemo,
  useState
} from 'react'

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

  const [sort,setSort]=useState('recommended')
  const [trustOnly,setTrustOnly]=useState(false)
  const [availableOnly,setAvailableOnly]=useState(false)
  const [nearOnly,setNearOnly]=useState(false)
  const [premiumOnly,setPremiumOnly]=useState(false)

  const filtered=useMemo(()=>{
    let items=[...pros]

    if(trustOnly){
      items=items.filter(
        (p:any)=>p.trust?.eligible
      )
    }

    if(availableOnly){
      items=items.filter((p:any)=>{
        const text=
          String(p.available||'').toLowerCase()

        return (
          text.includes('σήμερα') ||
          text.includes('άμεσα') ||
          text.includes('διαθέσ')
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
        (p:any)=>
          p.subscriptionPlan==='premium'
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

    /*
     * recommended:
     * διατηρεί αυστηρά το authoritative
     * server-side Smart Match ordering.
     */
    return items
  },[filtered,sort])


  const activeFilters=[
    trustOnly&&'MELEO Trust',
    availableOnly&&'Διαθέσιμοι τώρα',
    nearOnly&&'Έως 10 χλμ',
    premiumOnly&&'Premium'
  ].filter(Boolean)


  const hasSearchContext=
    !!(
      search.specialty ||
      search.service ||
      search.locationQuery ||
      search.locationLabel
    )


  const topMatches=
    sorted.filter(
      (p:any)=>p.smartMatch?.rank<=3
    ).length


  function resetDiscoveryFilters(){
    setTrustOnly(false)
    setAvailableOnly(false)
    setNearOnly(false)
    setPremiumOnly(false)
    setSort('recommended')
  }


  return (
    <section className="page discovery-page">
      <div className="container">


        {/* HERO */}

        <div className="discovery-page-hero">

          <div>

            <span className="discovery-page-kicker">
              MELEO SEARCH & DISCOVERY
            </span>

            <h1>
              Βρες τη σωστή φροντίδα.
              <br/>
              <em>
                Με καλύτερη πληροφόρηση.
              </em>
            </h1>

            <p>
              Η MELEO συνδυάζει ειδικότητα, υπηρεσία,
              τοποθεσία, διαθεσιμότητα και στοιχεία
              αξιοπιστίας ώστε να σε βοηθήσει να
              συγκρίνεις επαγγελματίες με μεγαλύτερη
              διαφάνεια.
            </p>

          </div>


          <div className="discovery-page-hero-badge">

            <span>✦</span>

            <div>
              <small>
                SMART MATCH
              </small>

              <strong>
                Ranking με πραγματικά signals
              </strong>

              <p>
                Trust, αξιολογήσεις, απόσταση,
                διαθεσιμότητα και συμπεριφορά.
              </p>
            </div>

          </div>

        </div>


        {/* SEARCH BOX */}

        <div className="discovery-search-shell">

          <SearchBox
            search={search}
            setSearch={setSearch}
            onSearch={async ()=>{
  await loadPros(search)

  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      document
        .getElementById('meleo-search-results')
        ?.scrollIntoView({
          behavior:'smooth',
          block:'start'
        })
    })
  })
}}
          />

        </div>


        {/* SEARCH CONTEXT */}

        {hasSearchContext&&
          <div className="discovery-context-strip">

            <div className="discovery-context-copy">

              <small>
                ΤΡΕΧΟΥΣΑ ΑΝΑΖΗΤΗΣΗ
              </small>

              <div>

                {search.specialty&&
                  <span>
                    {search.specialty}
                  </span>
                }

                {search.service&&
                  <span>
                    {search.service}
                  </span>
                }

                {(search.locationLabel||
                  search.locationQuery)&&
                  <span>
                    ⌖{' '}
                    {search.locationLabel||
                     search.locationQuery}
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
              Καθαρισμός
            </button>

          </div>
        }


        {/* DISCOVERY TOOLBAR */}

        <div
  id="meleo-search-results"
  className="discovery-toolbar"
>

          <div className="discovery-results-summary">

            <small>
              ΑΠΟΤΕΛΕΣΜΑΤΑ
            </small>

            <strong>
              {sorted.length}
            </strong>

            <span>
              {sorted.length===1
                ? 'επαγγελματίας'
                : 'επαγγελματίες'
              }
            </span>

            {topMatches>0&&
              <b>
                ✦ {topMatches} Smart Match
              </b>
            }

          </div>


          <div className="discovery-sort">

            <label>
              Ταξινόμηση

              <select
                value={sort}
                onChange={e=>
                  setSort(e.target.value)
                }
              >
                <option value="recommended">
                  Προτεινόμενοι · Smart Match
                </option>

                <option value="rating">
                  Καλύτερη αξιολόγηση
                </option>

                <option value="distance">
                  Κοντινότεροι
                </option>

                <option value="price">
                  Χαμηλότερο βασικό κόστος
                </option>
              </select>

            </label>

          </div>

        </div>


        {/* FILTERS */}

        <div className="discovery-filter-bar">

          <div className="discovery-filter-label">
            <span>☷</span>

            <div>
              <b>
                Φίλτρα
              </b>

              <small>
                Περιόρισε τα αποτελέσματα
              </small>
            </div>
          </div>


          <button
            type="button"
            className={
              trustOnly
                ? 'active'
                : ''
            }
            onClick={()=>
              setTrustOnly(v=>!v)
            }
          >
            ✦ MELEO Trust
          </button>


          <button
            type="button"
            className={
              availableOnly
                ? 'active'
                : ''
            }
            onClick={()=>
              setAvailableOnly(v=>!v)
            }
          >
            ⚡ Διαθέσιμοι τώρα
          </button>


          <button
            type="button"
            className={
              nearOnly
                ? 'active'
                : ''
            }
            onClick={()=>
              setNearOnly(v=>!v)
            }
          >
            ⌖ Έως 10 χλμ
          </button>


          <button
            type="button"
            className={
              premiumOnly
                ? 'active premium-filter'
                : 'premium-filter'
            }
            onClick={()=>
              setPremiumOnly(v=>!v)
            }
          >
            ◆ Premium
          </button>


          {activeFilters.length>0&&
            <button
              type="button"
              className="discovery-reset-filters"
              onClick={resetDiscoveryFilters}
            >
              × Καθαρισμός φίλτρων
            </button>
          }

        </div>


        {/* ACTIVE FILTER PILLS */}

        {activeFilters.length>0&&
          <div className="discovery-active-filters">

            <span>
              Ενεργά φίλτρα
            </span>

            {activeFilters.map(
              (x:any)=>
                <b key={x}>
                  {x}
                </b>
            )}

          </div>
        }


        {/* RESULTS */}

        {sorted.length
          ? <>

              {sort==='recommended'&&topMatches>0&&
                <div className="discovery-ranking-note">

                  <span>
                    ✦
                  </span>

                  <div>
                    <b>
                      Τα πρώτα αποτελέσματα ταξινομούνται
                      με MELEO Smart Match
                    </b>

                    <p>
                      Η σειρά συνδυάζει πολλαπλά signals.
                      Το Premium μπορεί να δίνει περιορισμένη
                      εμπορική ενίσχυση, αλλά δεν αντικαθιστά
                      την αξιοπιστία, τη συνάφεια και την
                      απόσταση.
                    </p>
                  </div>

                </div>
              }


              <div className="discovery-results">

                {sorted.map((p:any)=>
                  <ProCard
                    key={p.id}
                    p={p}
                    open={()=>openPro(p)}
                    favorite={
                      favorites.includes(p.id)
                    }
                    toggle={()=>
                      toggleFav(p.id)
                    }
                  />
                )}

              </div>

            </>

          : <div className="discovery-empty">

              <div className="discovery-empty-mark">
                ⌕
              </div>

              <small>
                ΔΕΝ ΒΡΕΘΗΚΑΝ ΑΠΟΤΕΛΕΣΜΑΤΑ
              </small>

              <h2>
                Δεν βρήκαμε επαγγελματία
                με αυτά τα κριτήρια.
              </h2>

              <p>
                Δοκίμασε να αφαιρέσεις κάποιο φίλτρο,
                να αυξήσεις την περιοχή αναζήτησης
                ή να δεις όλους τους επαγγελματίες
                της ειδικότητας.
              </p>

              <div className="discovery-empty-actions">

                {activeFilters.length>0&&
                  <button
                    className="btn btn-dark"
                    onClick={resetDiscoveryFilters}
                  >
                    Καθαρισμός φίλτρων
                  </button>
                }

                <button
                  className="btn btn-outline"
                  onClick={()=>{
                    const next={
                      ...search,
                      service:''
                    }

                    setSearch(next)
                    loadPros(next)
                    resetDiscoveryFilters()
                  }}
                >
                  Όλες οι υπηρεσίες
                </button>

              </div>

            </div>
        }


        {/* EXPLAINER */}

        <div className="discovery-explainer">

          <span>
            ⓘ
          </span>

          <p>
            Η MELEO είναι marketplace εύρεσης επαγγελματιών.
            Η σειρά των αποτελεσμάτων είναι υποβοηθητική και
            δεν αποτελεί ιατρική σύσταση ή εγγύηση
            καταλληλότητας για συγκεκριμένο περιστατικό.
          </p>

        </div>


      </div>
    </section>
  )
}

export default SearchPage

