import express from 'express'
import generateDocumentChunks from '../utils/generateDocumentChunks..mjs'

const router = express.Router()

router.post('/generate-chunks', async (req, res) => {
  const { documentUrl, chunkSize, overlapLength } = req.body

  if (!documentUrl) {
    return res.status(400).json({ error: 'Missing documentUrl parameter' })
  }

  try {
    const chunks = await generateDocumentChunks(documentUrl, chunkSize, overlapLength)
    res.json({ chunks })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error generating document chunks' })
  }
})

export default router
