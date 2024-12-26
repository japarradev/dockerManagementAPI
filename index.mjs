import express from 'express'
import routes from './routes/routes.mjs'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Middleware to parse JSON bodies
app.use(express.json())

// Import routes

// Use the routes
app.use('/api/v1', routes)

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
