# Usa la imagen oficial de Node.js 21 como imagen base
FROM node:21

# Establece el directorio de trabajo
WORKDIR /usr/src/app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto definido en .env
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "index.mjs"]
