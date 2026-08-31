import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const root=process.cwd(), srcRoot=path.join(root,'src')
const baselinePath=path.join(root,'scripts','rc3-d7a-i18n-residue-baseline.json')
const writeBaseline=process.argv.includes('--write-baseline')
const greek=/[\u0370-\u03ff\u1f00-\u1fff]/
function walk(d){const out=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())out.push(...walk(f));else if(/\.(ts|tsx)$/.test(e.name)&&e.name!=='i18n.ts')out.push(f)}return out}
function compact(v){return String(v).replace(/\s+/g,' ').trim()}
function kind(n){if(ts.isJsxText(n))return'jsx';if(ts.isStringLiteral(n))return'string';if(ts.isNoSubstitutionTemplateLiteral(n))return'template';if(ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n))return'template';return null}
const findings=[]
for(const file of walk(srcRoot)){const source=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(n){const k=kind(n);if(k){const raw=ts.isJsxText(n)?n.getText(sf):n.text;const text=compact(raw);if(text&&greek.test(text)){const p=sf.getLineAndCharacterOfPosition(n.getStart(sf));findings.push({file:path.relative(root,file).replaceAll('\\','/'),line:p.line+1,kind:k,text})}}ts.forEachChild(n,visit)}visit(sf)}
findings.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.kind.localeCompare(b.kind)||a.text.localeCompare(b.text))
const sig=f=>`${f.file}|${f.kind}|${f.text}`
const counts=a=>{const m=new Map();for(const x of a){const s=sig(x);m.set(s,(m.get(s)||0)+1)}return m}
if(writeBaseline){fs.writeFileSync(baselinePath,JSON.stringify({schema:1,purpose:'RC3-D7A frontend i18n residue baseline',note:'Removal allowed; new/increased Greek UI literals outside src/i18n.ts rejected.',findings},null,2)+'\n');console.log(`RC3-D7-A baseline written: ${findings.length} residue(s)`);process.exit(0)}
if(!fs.existsSync(baselinePath)){console.error('RC3-D7-A i18n residue self-test: FAIL\n- baseline file missing');process.exit(1)}
const base=JSON.parse(fs.readFileSync(baselinePath,'utf8')), allowed=counts(base.findings||[]), current=counts(findings), additions=[]
for(const [s,c] of current){const max=allowed.get(s)||0;if(c>max)additions.push({s,c,max})}
if(additions.length){console.error('RC3-D7-A i18n residue self-test: FAIL');for(const a of additions.slice(0,25))console.error(`- ${a.s} (${a.c} > ${a.max})`);process.exit(1)}
console.log(`RC3-D7-A i18n residue self-test: PASS (${findings.length}/${(base.findings||[]).length} baseline residues remain)`)
