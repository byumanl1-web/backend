# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copiar el resto del código
COPY . .

ENV NODE_ENV=production

# (Opcional) expone el puerto en el que escucha tu server (4010 por defecto)
EXPOSE 4010

# Arrancar el servidor SIN importar la BD
CMD ["npm","start"]
