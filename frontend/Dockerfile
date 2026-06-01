# --- Этап 1: Сборка приложения ---
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# --- Этап 2: Раздача через Nginx ---
FROM nginx:alpine

# Копируем собранный фронтенд в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем конфигурацию Nginx для проксирования API и WebSocket
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]