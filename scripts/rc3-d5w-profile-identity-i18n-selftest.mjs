import fs from 'node:fs'

const read=p=>fs.readFileSync(p,'utf8')
const fail=m=>{console.error('RC3-D5-W profile identity i18n self-test: FAIL - '+m);process.exit(1)}

const x=read('src/App.tsx')
const i=read('src/i18n.ts')
const p=JSON.parse(read('package.json'))

for(const q of [
  "function ProfileIdentityModal({",
  "const {t}=useTranslation()",
  "t('patient.profileIdentity.avatarUpdated')",
  "t('patient.profileIdentity.invalidType')",
  "t('patient.profileIdentity.tooLarge')",
  "t('patient.profileIdentity.photoSaved')",
  "t('patient.profileIdentity.photoRemoved')",
  "t('patient.profileIdentity.kicker')",
  "t('patient.profileIdentity.title')",
  "t('patient.profileIdentity.intro')",
  "t('patient.profileIdentity.close')",
  "t('patient.profileIdentity.optional')",
  "t('patient.profileIdentity.chooseAvatar')",
  "t('patient.profileIdentity.avatarAria',{key})",
  "t('patient.profileIdentity.or')",
  "t('patient.profileIdentity.uploadTitle')",
  "t('patient.profileIdentity.choosePhoto')",
  "t('patient.profileIdentity.zoom')",
  "t('patient.profileIdentity.moveUp')",
  "t('patient.profileIdentity.moveLeft')",
  "t('patient.profileIdentity.moveRight')",
  "t('patient.profileIdentity.moveDown')",
  "t('patient.profileIdentity.saving')",
  "t('patient.profileIdentity.savePhoto')",
  "t('patient.profileIdentity.removePhoto')"
]){
  if(!x.includes(q)) fail('App.tsx '+q)
}

if((i.match(/profileIdentity:\{avatarUpdated:/g)||[]).length!==2) fail('profileIdentity object count')

if(p.scripts?.['rc3-d5w-check']!=='node scripts/rc3-d5w-profile-identity-i18n-selftest.mjs') fail('package script')
if(!p.scripts?.['ci:gate']?.includes('npm run rc3-d5v-check && npm run rc3-d5w-check')) fail('ci gate sequence')

console.log('RC3-D5-W profile identity i18n self-test: PASS')