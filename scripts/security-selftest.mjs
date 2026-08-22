process.env.SENSITIVE_DATA_KEY='development-selftest-key-0123456789abcdef'
const { encryptSensitive, decryptSensitive, escapeHtml } = await import('../server/security.js')
const sample='Ευαίσθητη σημείωση: test <script>alert(1)</script>'
const encrypted=encryptSensitive(sample)
if(!encrypted.startsWith('enc:v1:')) throw new Error('Encryption failed')
if(decryptSensitive(encrypted)!==sample) throw new Error('Decryption failed')
if(escapeHtml('<script>')!=='&lt;script&gt;') throw new Error('HTML escaping failed')
console.log('MELEO security self-test: OK')
