import i18n from '../i18n'

export const API='/api'
export async function api<T=any>(path:string,options:any={},_token=''):Promise<T>{
  const r=await fetch(API+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}})
  const d=await r.json().catch(()=>({}))
    if(!r.ok){
    throw new Error(
      (d as any).error||
      i18n.t('apiErrors.generic')
    )
  }
  return d as T
}
