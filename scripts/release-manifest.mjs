import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const roots=['package.json','package-lock.json','Dockerfile','docker-compose.yml','.env.example','server','src','migrations','deploy','.github','scripts']
const skip=new Set(['reports','node_modules','dist','.git'])
const files=[]
function walk(p){
  if(!fs.existsSync(p)) return
  const st=fs.statSync(p)
  if(st.isDirectory()){
    if(skip.has(path.basename(p))) return
    for(const n of fs.readdirSync(p).sort()) walk(path.join(p,n))
  }else files.push(p.replaceAll('\\','/'))
}
for(const r of roots) walk(r)
const entries=files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sizeBytes:fs.statSync(file).size}))
const manifest={product:'MELEO',version:'6.2.1',channel:'production',generatedAt:new Date().toISOString(),files:entries}
fs.mkdirSync('reports',{recursive:true})
fs.writeFileSync('reports/release-manifest-v6.2.1.json',JSON.stringify(manifest,null,2))
console.log(`MELEO v6.0 release manifest: ${entries.length} files hashed`)
