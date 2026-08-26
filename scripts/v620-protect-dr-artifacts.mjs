import fs from 'node:fs'

const file = '.gitignore'

let source = fs
  .readFileSync(file, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')

const required = [
  'backups/',
  'reports/*.txt'
]

for (const entry of required) {
  if (
    !source
      .split('\n')
      .map(x => x.trim())
      .includes(entry)
  ) {
    source =
      source.replace(/\n*$/, '') +
      '\n' +
      entry +
      '\n'
  }
}

source =
  source
    .split('\n')
    .map(line =>
      line.replace(/[ \t]+$/, '')
    )
    .join('\n')
    .replace(/\n*$/, '') +
  '\n'

fs.writeFileSync(
  file,
  source,
  'utf8'
)

console.log(
  '[PASS] backups/ excluded from Git'
)

console.log(
  '[PASS] local diagnostic TXT reports excluded from Git'
)
