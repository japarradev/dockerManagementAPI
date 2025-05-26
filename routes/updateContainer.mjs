import express from 'express'
import Docker from 'dockerode'

const docker = new Docker()
const router = express.Router()

router.post('/update-container', async (req, res) => {
  console.log('updateContainer')
  const { Image, name, Env, Port } = req.body

  try {
    const hostConfig = {
      PortBindings: {
        [`${Port}/tcp`]: [
          {
            HostPort: `${Port}`
          }
        ]
      },
      Binds: [`${process.cwd()}/sessions/bot_sessions:/${name}/bot_sessions:rw`],
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

    const container = docker.getContainer(name)
    try {
      const containerInfo = await container.inspect()
      if (containerInfo.State.Running) {
        await container.stop()
      }
      await container.remove()
    } catch (err) {
      console.log(`Failed to remove container: ${err.message}`)
    }
    console.log(containerConfig)
    await docker.createContainer(containerConfig)

    res.status(200).send({ message: 'Container updated successfully' })
  } catch (error) {
    res.status(500).send({ error: error.message })
  }
})

export default router
