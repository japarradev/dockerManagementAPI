import express from 'express'
import Docker from 'dockerode'
import path from 'path'
const router = express.Router()
const docker = new Docker()

router.post('/create-container', async (req, res) => {
  const { Image, name, Env, Port } = req.body

  const hostSessionsPath = path.join('/sessions', name)

  const hostConfig = {
    PortBindings: {
      [`${Port}/tcp`]: [
        {
          HostPort: `${Port}`
        }
      ]
    },
    Binds: [`${hostSessionsPath}:/app/bot_sessions:rw`],
    CapAdd: ['SYS_ADMIN'],
    RestartPolicy: {
      Name: 'always'
    }
  }

  const containerConfig = {
    Image,
    name,
    Env: Object.entries(Env).map(([key, value]) => `${key}=${value}`),
    ExposedPorts: { [`${Port}/tcp`]: {} },
    HostConfig: hostConfig,
    Volumes: {
      '/app/bot_sessions': {}
    }
  }

  try {
    await new Promise((resolve, reject) => {
      docker.pull(Image, (err, stream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
    const container = await docker.createContainer(containerConfig)
    await container.start()
    res.status(201).send({ message: 'Bot creado satisfactoriamente', containerId: container.id })
  } catch (error) {
    res.status(500).send({ error: `Fallo al cre: ${error.message}` })
    console.error(`Error creating container: ${error.message}`)
  }
})

export default router
