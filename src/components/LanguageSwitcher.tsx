import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './language-switcher.css'

export default function LanguageSwitcher(){
  const {i18n}=useTranslation()
  const [open,setOpen]=useState(false)
  const root=useRef<HTMLDivElement>(null)
  const language=i18n.language==='en'?'en':'el'
  const nativeLabel=language==='en'?'English':'Ελληνικά'

  useEffect(()=>{
    const outside=(e:MouseEvent)=>{
      if(root.current&&!root.current.contains(e.target as Node))setOpen(false)
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

  return <div className="meleo-language" ref={root}>
    <button
      type="button"
      className={'meleo-language-trigger '+(open?'is-open':'')}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={language==='en'?'Change language':'Αλλαγή γλώσσας'}
      onClick={()=>setOpen(v=>!v)}
    >
      <span className="meleo-language-monogram" aria-hidden="true">{language.toUpperCase()}</span>
      <span className="meleo-language-native desktop-language-label">{nativeLabel}</span>
      <svg className="meleo-language-chevron" viewBox="0 0 12 8" aria-hidden="true">
        <path d="M1.5 1.5 6 6l4.5-4.5"/>
      </svg>
    </button>

    {open&&<div className="meleo-language-menu" role="menu" aria-label={language==='en'?'Language':'Γλώσσα'}>
      <div className="meleo-language-menu-kicker">MELEO · LANGUAGE</div>
      <button type="button" role="menuitemradio" aria-checked={language==='el'} onClick={()=>void choose('el')}>
        <span className="meleo-language-option-code">EL</span>
        <span className="meleo-language-option-copy"><b>Ελληνικά</b><small>Greek</small></span>
        <span className="meleo-language-check" aria-hidden="true">{language==='el'?'✓':''}</span>
      </button>
      <button type="button" role="menuitemradio" aria-checked={language==='en'} onClick={()=>void choose('en')}>
        <span className="meleo-language-option-code">EN</span>
        <span className="meleo-language-option-copy"><b>English</b><small>Αγγλικά</small></span>
        <span className="meleo-language-check" aria-hidden="true">{language==='en'?'✓':''}</span>
      </button>
    </div>}
  </div>
}
