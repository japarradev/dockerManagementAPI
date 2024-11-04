const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const docker = new Docker(); // Conéctate al demonio de Docker

// Endpoint para iniciar o detener un contenedor
router.post('/manage-container', async (req, res) => {
    const { containerName, state } = req.body;

    if (!containerName || !state) {
        return res.status(400).json({ message: 'Container name and state are required' });
    }

    try {
        const container = docker.getContainer(containerName);

        if (state === 'start') {
            await container.start();
            return res.json({ message: `Container ${containerName} started` });
        } else if (state === 'stop') {
            await container.stop();
            return res.json({ message: `Container ${containerName} stopped` });
        } else {
            return res.status(400).json({ message: 'Invalid state. Use "start" or "stop".' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while managing the container', error: error.message });
    }
});

module.exports = router;
