import express from 'express'
import Docker from 'dockerode'
import path from 'path'
const router = express.Router()
const docker = new Docker()

router.post('/create-container', async (req, res) => {
  const { Image, name, guid, server, Env, Port } = req.body

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
    Hostname: guid, // Agregar hostname
    Env: Object.entries(Env).map(([key, value]) => `${key}=${value}`),
    ExposedPorts: { [`${Port}/tcp`]: {} },
    Labels: {
      // Etiquetas de Traefik
      [`traefik.http.routers.${guid}.rule`]: `Host(\`${server}\`) && PathPrefix(\`/${guid}\`)`,
      [`traefik.http.routers.${guid}.entrypoints`]: 'websecure',
      [`traefik.http.routers.${guid}.tls`]: 'true',
      [`traefik.http.routers.${guid}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.routers.${guid}.middlewares`]: `strip-${guid}`,
      [`traefik.http.middlewares.strip-${guid}.stripprefix.prefixes`]: `/${guid}`,
      [`traefik.http.services.${guid}.loadbalancer.server.port`]: Port.toString(),
      // Habilitar Traefik para este contenedor
      'traefik.enable': 'true'
    },
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
    res.status(201).send({
      message: 'Bot creado satisfactoriamente',
      containerId: container.id,
      hostname: name,
      domain: server,
      traefik_url: `https://${server}/${guid}`
    })
  } catch (error) {
    res.status(500).send({ error: `Fallo al crear: ${error.message}` })
    console.error(`Error creating container: ${error.message}`)
  }
})

export default router
