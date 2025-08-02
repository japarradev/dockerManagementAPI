import express from 'express'
import Docker from 'dockerode'
import path from 'path'

const docker = new Docker()
const router = express.Router()

router.post('/update-container', async (req, res) => {
  console.log('updateContainer')
  const { Image, name, guid, server, Env, Port } = req.body

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
      Hostname: name, // Agregar hostname
      Env: Object.entries(Env).map(([key, value]) => `${key}=${value}`),
      ExposedPorts: { [`${Port}/tcp`]: {} },
      Labels: {
        // Etiquetas de Traefik
        [`traefik.http.routers.${name}.rule`]: `Host(\`${server}\`) && PathPrefix(\`/${guid}\`)`,
        [`traefik.http.routers.${name}.entrypoints`]: 'websecure',
        [`traefik.http.routers.${name}.tls`]: 'true',
        [`traefik.http.routers.${name}.tls.certresolver`]: 'letsencrypt',
        [`traefik.http.routers.${name}.middlewares`]: `strip-${name}`,
        [`traefik.http.middlewares.strip-${name}.stripprefix.prefixes`]: `/${guid}`,
        [`traefik.http.services.${name}.loadbalancer.server.port`]: Port.toString(),
        // Habilitar Traefik para este contenedor
        'traefik.enable': 'true'
      },
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
    const newContainer = await docker.createContainer(containerConfig)
    await newContainer.start()

    res.status(200).send({
      message: 'Container updated successfully',
      containerId: newContainer.id,
      hostname: name,
      domain: server,
      traefik_url: `https://${server}/${guid}`
    })
  } catch (error) {
    res.status(500).send({ error: error.message })
  }
})

export default router
