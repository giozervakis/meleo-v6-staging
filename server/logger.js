import crypto from 'node:crypto'

const instance=process.env.INSTANCE_ID||process.env.HOSTNAME||'local'
const clean=(v)=>{
  if(v instanceof Error)return {name:v.name,message:v.message,stack:process.env.NODE_ENV==='production'?undefined:v.stack}
  if(v&&typeof v==='object')return v
  return v
}
function emit(level,event,meta={}){
  const row={ts:new Date().toISOString(),level,event,service:'meleo',instance,...Object.fromEntries(Object.entries(meta).map(([k,v])=>[k,clean(v)]))}
  const line=JSON.stringify(row)
  ;(level==='error'?console.error:level==='warn'?console.warn:console.log)(line)
}
export const log={info:(event,meta)=>emit('info',event,meta),warn:(event,meta)=>emit('warn',event,meta),error:(event,meta)=>emit('error',event,meta)}
export const requestId=(incoming)=>{const x=String(incoming||'').trim();return /^[a-zA-Z0-9._:-]{8,128}$/.test(x)?x:crypto.randomUUID()}
