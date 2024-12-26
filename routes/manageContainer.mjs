import express from 'express'
import Docker from 'dockerode'

const docker = new Docker()
const router = express.Router()

router.post('/manage-container', async (req, res) => {
  const { containerName, state } = req.body

  if (!containerName || !state) {
    return res.status(400).json({ message: 'Container name and state are required' })
  }

  try {
    const container = docker.getContainer(containerName)

    if (state === 'start') {
      await container.start()
      return res.json({ message: `Bot ${containerName} started` })
    } else if (state === 'stop') {
      await container.stop()
      return res.json({ message: `Bot ${containerName} stopped` })
    } else if (state === 'restart') {
      await container.restart()
      return res.json({ message: `Bot ${containerName} restarted` })
    } else {
      return res.status(400).json({ message: 'Invalid state. Use "start", "stop", or "restart".' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'An error occurred while managing the container', error: error.message })
  }
})

export default router
