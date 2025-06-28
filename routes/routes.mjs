import express from 'express'
import manageContainerRoute from './manageContainer.mjs'
import createContainerRoute from './createContainer.mjs'
import updateContainerRoute from './updateContainer.mjs'
import sendEmailRoute from './sendEmail.mjs'
import removeSessionRoute from './removeSession.mjs'

const router = express.Router()

router.use(manageContainerRoute)
router.use(createContainerRoute)
router.use(updateContainerRoute)
router.use(sendEmailRoute)
router.use(removeSessionRoute)

export default router
