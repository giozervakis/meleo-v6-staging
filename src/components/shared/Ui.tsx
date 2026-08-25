import { useEffect } from 'react'

export function Mark(){
  return (
    <div className="brand">
      <span className="brand-glyph">M</span>
      <span>MELEO</span>
    </div>
  )
}

export function Toast({
  text,
  onClose
}:{
  text:string
  onClose:()=>void
}){
  useEffect(()=>{
    const t=setTimeout(onClose,3200)
    return()=>clearTimeout(t)
  },[])

  return <div className="toast">{text}</div>
}

export function Empty({
  title,
  text
}:{
  title:string
  text:string
}){
  return (
    <div className="empty">
      <div>◇</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

export function Stat({
  label,
  value,
  note
}:{
  label:any
  value:any
  note:any
}){
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

export function DashboardHead({
  eyebrow,
  title,
  subtitle
}:{
  eyebrow:any
  title:any
  subtitle:any
}){
  return (
    <div className="dashboard-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}
