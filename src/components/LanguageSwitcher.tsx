import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './language-switcher.css'

export default function LanguageSwitcher(){
  const {i18n}=useTranslation()
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const language=i18n.language==='en'?'en':'el'

  useEffect(()=>{
    const outside=(e:MouseEvent)=>{
      if(root.current&&!root.current.contains(e.target as Node)){
        setOpen(false)
      }
    }
    const escape=(e:KeyboardEvent)=>{
      if(e.key==='Escape')setOpen(false)
    }

    document.addEventListener('mousedown',outside)
    document.addEventListener('keydown',escape)

    return()=>{
      document.removeEventListener('mousedown',outside)
      document.removeEventListener('keydown',escape)
    }
  },[])

  async function choose(next:'el'|'en'){
    await i18n.changeLanguage(next)
    setOpen(false)
  }

  return (
    <div className="meleo-language" ref={root}>
      <button
        type="button"
        className="meleo-language-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={language==='en'?'Change language':'Αλλαγή γλώσσας'}
        onClick={()=>setOpen(v=>!v)}
      >
        <span className="meleo-language-icon" aria-hidden="true">◎</span>
        <strong>{language.toUpperCase()}</strong>
        <span className="meleo-language-chevron" aria-hidden="true">⌄</span>
      </button>

      {open&&
        <div className="meleo-language-menu" role="menu">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={language==='el'}
            onClick={()=>void choose('el')}
          >
            <span><b>Ελληνικά</b><small>Greek</small></span>
            <em>EL</em>
            {language==='el'&&<i aria-hidden="true">✓</i>}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={language==='en'}
            onClick={()=>void choose('en')}
          >
            <span><b>English</b><small>Αγγλικά</small></span>
            <em>EN</em>
            {language==='en'&&<i aria-hidden="true">✓</i>}
          </button>
        </div>
      }
    </div>
  )
}
