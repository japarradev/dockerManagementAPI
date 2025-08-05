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
      // Eliminar PortBindings ya que no los necesitas
      Binds: [`${hostSessionsPath}:/app/bot_sessions:rw`],
      CapAdd: ['SYS_ADMIN'],
      RestartPolicy: {
        Name: 'always'
      },
      // Agregar la red de Traefik
      NetworkMode: 'traefik'
    }

    const containerConfig = {
      Image,
      name,
      Hostname: guid,
      Env: Object.entries(Env).map(([key, value]) => `${key}=${value}`),
      // Eliminar ExposedPorts ya que no los necesitas
      Labels: {
        // Etiquetas de Traefik corregidas
        'traefik.enable': 'true',
        [`traefik.http.routers.${guid}.rule`]: `PathPrefix(\`/${guid}\`)`,
        [`traefik.http.routers.${guid}.entrypoints`]: 'websecure',
        [`traefik.http.routers.${guid}.tls`]: 'true',
        [`traefik.http.routers.${guid}.rule`]: `Host(\`${server}\`)`,
        [`traefik.http.routers.${guid}.middlewares`]: `strip-${guid}`,
        [`traefik.http.middlewares.strip-${guid}.stripprefix.prefixes`]: `/${guid}`,
        [`traefik.http.services.${guid}.loadbalancer.server.port`]: Port.toString()
      },
      HostConfig: hostConfig,
      Volumes: {
        '/app/bot_sessions': {}
      }
    }

    // Pull de la imagen antes de crear el nuevo contenedor
    await new Promise((resolve, reject) => {
      docker.pull(Image, (err, stream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })

    // Obtener y eliminar el contenedor existente
    const container = docker.getContainer(name)
    try {
      const containerInfo = await container.inspect()
      if (containerInfo.State.Running) {
        console.log(`Stopping container: ${name}`)
        await container.stop()
      }
      console.log(`Removing container: ${name}`)
      await container.remove()
    } catch (err) {
      // Si el contenedor no existe, no es un error crítico
      console.log(`Container ${name} not found or already removed: ${err.message}`)
    }

    console.log('Creating new container with config:', containerConfig)
    const newContainer = await docker.createContainer(containerConfig)
    await newContainer.start()

    res.status(200).send({
      message: 'Container updated successfully',
      containerId: newContainer.id,
      hostname: guid, // Cambié de name a guid para consistencia
      domain: server,
      traefik_url: `https://${server}/${guid}`
    })
  } catch (error) {
    console.error(`Error updating container: ${error.message}`)
    res.status(500).send({ error: `Failed to update container: ${error.message}` })
  }
})

export default router
