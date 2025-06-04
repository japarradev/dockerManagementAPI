import express from 'express'
import Docker from 'dockerode'
import path from 'path'

const docker = new Docker()
const router = express.Router()

router.post('/update-container', async (req, res) => {
  console.log('updateContainer')
  const { Image, name, Env, Port } = req.body

  try {
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

    await new Promise((resolve, reject) => {
      docker.pull(Image, (err, stream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
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
    await docker.getContainer(name).start()
    res.status(200).send({ message: 'Container updated successfully' })
  } catch (error) {
    res.status(500).send({ error: error.message })
  }
})

export default router
