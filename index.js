// index.js
const express = require('express')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 3000

// Middleware to parse JSON bodies
app.use(express.json())

// Import routes
const dataRoutes = require('./routes/dataRoutes')

// Use the routes
app.use('/api/v1', dataRoutes)

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
