import fs from 'node:fs'
import path from 'node:path'

const root = 'src/features'

const violations = []

function walk(dir) {
  for (
    const entry of fs.readdirSync(
      dir,
      { withFileTypes:true }
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name
      )

    if (entry.isDirectory()) {
      walk(full)
      continue
    }

    if (
      !/\.(tsx|ts)$/.test(entry.name) ||
      /\.bak$/i.test(entry.name)
    ) {
      continue
    }

    const source =
      fs.readFileSync(
        full,
        'utf8'
      )

    const patterns = [
      /MELEO Professional v\d+\.\d+(?:\.\d+)?/,
      /MELEO v\d+(?:\.\d+){0,2}\s*·\s*FOUNDER/
    ]

    for (const re of patterns) {
      if (re.test(source)) {
        violations.push(
          `${full}: ${re}`
        )
      }
    }
  }
}

walk(root)

if (violations.length) {
  console.error(
    'Hardcoded frontend release identity detected:'
  )

  for (const item of violations) {
    console.error(
      ' -',
      item
    )
  }

  process.exit(1)
}

console.log(
  'MELEO frontend version identity check: OK'
)
