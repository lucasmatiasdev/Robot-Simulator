import { Router } from 'express'
import { postLogin } from '../controllers/login.controller.js'

export const loginRouter = Router()

loginRouter.post('/login', postLogin)

