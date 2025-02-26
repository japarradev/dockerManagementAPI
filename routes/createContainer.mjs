import express from 'express'
import Docker from 'dockerode'

const router = express.Router()
const docker = new Docker()

router.post('/create-container', async (req, res) => {
  const { Image, name, Env, Port } = req.body
  const hostConfig = {
    PortBindings: {
      [`${Port}/tcp`]: [
        {
          HostPort: `${Port}`
        }
      ]
    },
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
    HostConfig: hostConfig

  }
  try {
    await docker.pull(Image, (err, stream) => {
      if (err) {
        throw new Error(`Failed to pull image: ${err.message}`)
      }
      docker.modem.followProgress(stream, onFinished, onProgress)

      function onFinished (err, output) {
        if (err) {
          throw new Error(`Failed to pull image: ${err.message}`)
        }
      }

      function onProgress (event) {
        console.log(event)
      }
    })
  } catch (error) {
    res.status(500).send({ error: `Failed to pull image: ${error.message}` })
  }
  try {
    const container = await docker.createContainer(containerConfig)
    console.log(`Container ${container.id} created`)
    // await container.start()
    console.log(`Container ${container.id} started`)
    res.status(201).send({ message: 'Container created successfully', containerId: container.id })
  } catch (error) {
    res.status(500).send({ error: `Failed to create or start container: ${error.message}` })
  }
})

export default router
