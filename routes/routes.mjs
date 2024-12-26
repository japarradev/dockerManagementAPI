import express from 'express'
import manageContainerRoute from './manageContainer.mjs'
import createContainerRoute from './createContainer.mjs'
import updateContainerRoute from './updateContainer.mjs'

const router = express.Router()

router.use(manageContainerRoute)
router.use(createContainerRoute)
router.use(updateContainerRoute)

export default router
