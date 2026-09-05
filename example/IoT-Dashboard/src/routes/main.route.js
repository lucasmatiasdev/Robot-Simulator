import { Router } from 'express'
import { getDashboard, getDemo, getTools, getWebPage } from '../controllers/main.controller.js'

export const mainRouter = Router()

mainRouter.get('/', getWebPage)

mainRouter.get('/tools', getTools)

mainRouter.get('/dashboard', getDashboard)

mainRouter.post('/', getDemo)

mainRouter.put('/', getDemo)

mainRouter.delete('/', getDemo)
