import { response } from "express"

export const corsConfig = (req, res = response, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT', 'DELETE')
  res.header('Allow', 'GET, POST, PUT', 'DELETE')
  next()
}
