import fs from 'fs'
import path from 'path'
import express from 'express'

const router = express.Router()

router.post('/remove-session', async (req, res) => {
  const { name } = req.body
  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' })
  }

  const dirPath = path.join('/sessions', name)

  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
      return res.json({ message: `Directory /sessions/${name} removed` })
    } else {
      return res.status(404).json({ error: 'Directory does not exist' })
    }
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
