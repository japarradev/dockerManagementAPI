import express from 'express'
import Docker from 'dockerode'

const docker = new Docker()
const router = express.Router()

router.post('/manage-container', async (req, res) => {
  const { containerName, state } = req.body

  if (!containerName || !state) {
    return res.status(400).json({ message: 'Nombre del contenedor es requerido' })
  }

  try {
    const container = docker.getContainer(containerName)

    if (state === 'start') {
      await container.start()
      return res.json({ message: `Bot ${containerName} ha iniciado` })
    } else if (state === 'stop') {
      await container.stop()
      return res.json({ message: `Bot ${containerName} se ha detenido` })
    } else if (state === 'restart') {
      await container.restart()
      return res.json({ message: `Bot ${containerName} se ha reiniciado` })
    } else {
      return res.status(400).json({ message: 'Error el proceso contáctese con el soporte técnico' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'An error occurred while managing the container', error: error.message })
  }
})

export default router
