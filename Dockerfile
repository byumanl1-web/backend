# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instala dependencias primero (aprovecha caché de Docker)
COPY package*.json ./
RUN npm ci || npm install

# Copia el resto del código del backend
COPY . .

ENV NODE_ENV=production

# --- PRIMER DESPLIEGUE: importamos la BD y arrancamos ---
# Cuando el import ya haya corrido OK, CAMBIA esta línea por:  CMD ["npm","start"]
CMD ["sh","-lc","npm run import:sql && npm start"]
