import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const readJson = async (file) => {
  const data = fs.readFileSync(path.join(__dirname, '..', 'data', file))
  // console.log(`Información leida de ${file}`)
  return JSON.parse(data)
}
export const saveJson = async (data, file) => {
  const json = JSON.stringify(data, null, 2)
  fs.writeFileSync(path.join(__dirname, '..', 'data', file), json)
  console.log(`Nueva información guardada en ${file}`)
}
