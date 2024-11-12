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
            return res.json({ message: `Bot ${containerName} started` });
        } else if (state === 'stop') {
            await container.stop();
            return res.json({ message: `Bot ${containerName} stopped` });
        } else {
            return res.status(400).json({ message: 'Invalid state. Use "start" or "stop".' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while managing the container', error: error.message });
    }
});

// Endpoint para crear un nuevo contenedor
router.post('/create-container', async (req, res) => {
    const {
        psqlHost,
        psqlPort,
        psqlUser,
        psqlPass,
        psqlDbName,
        COST_AUDIO_TXT,
        COST_TXT_AUDIO_ELEV,
        COST_TXT_AUDIO_POLLY,
        COST_GPT_INPUT,
        COST_GPT_OUTPUT,
        COST_GPT_EXTRA,
        containerName,
        port,
        companyID,
        OPENAI_API_KEY,
        aws_access_key_id,
        aws_secret_access_key,
        EVENT_TOKEN,
        GPT_MODEL
    } = req.body;

    // Validar parámetros requeridos
    if (!containerName || !port || !companyID || !OPENAI_API_KEY || !aws_access_key_id || !aws_secret_access_key || !EVENT_TOKEN || !psqlHost || !psqlPort || !psqlUser || !psqlPass || !psqlDbName || !GPT_MODEL) {
        return res.status(400).json({ message: 'All required parameters must be provided' });
    }

    try {
        const envVariables = [
            `OPENAI_API_KEY=${OPENAI_API_KEY}`,
            `aws_access_key_id=${aws_access_key_id}`,
            `aws_secret_access_key=${aws_secret_access_key}`,
            `COMPANY_GUID=${companyID}`,
            `EVENT_TOKEN=${EVENT_TOKEN}`,
            `POSTGRES_DB_HOST=${psqlHost === 'localhost' ? 'host.docker.internal' : psqlHost}`,
            `POSTGRES_DB_USER=${psqlUser}`,
            `POSTGRES_DB_PASSWORD=${psqlPass}`,
            `POSTGRES_DB_NAME=${psqlDbName}`,
            `POSTGRES_DB_PORT=${psqlPort}`,
            `COST_AUDIO_TXT=${COST_AUDIO_TXT || 0.0072}`,
            `COST_TXT_AUDIO_ELEV=${COST_TXT_AUDIO_ELEV || 0.264}`,
            `COST_TXT_AUDIO_POLLY=${COST_TXT_AUDIO_POLLY || 0.00192}`,
            `COST_GPT_INPUT=${COST_GPT_INPUT || 0.00018}`,
            `COST_GPT_OUTPUT=${COST_GPT_OUTPUT || 0.00072}`,
            `COST_GPT_EXTRA=${COST_GPT_EXTRA || 0.0005}`,
            `GPT_MODEL=${GPT_MODEL}`,
            `PORT=${port}`
        ];

        const hostConfig = {
            PortBindings: {
                [`${port}/tcp`]: [
                    {
                        HostPort: `${port}`
                    }
                ]
            },
            CapAdd: ['SYS_ADMIN'],
            RestartPolicy: {
                Name: 'always'
            }
        };

        // Añadir configuración para localhost
        if (psqlHost === 'localhost') {
            hostConfig.ExtraHosts = ['host.docker.internal:host-gateway'];
        }

        const containerConfig = {
            Image: 'japarradev/template:latest',
            name: containerName,
            Env: envVariables,
            ExposedPorts: {
                [`${port}/tcp`]: {}
            },
            HostConfig: hostConfig
        };

        // Crear y ejecutar el contenedor
        const container = await docker.createContainer(containerConfig);
        await container.start();

        return res.json({ message: `Container ${containerName} created and started`, containerId: container.id });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'An error occurred while creating the container', error: error.message });
    }
});

module.exports = router;
