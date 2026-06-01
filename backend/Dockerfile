# Используем легковесный образ Python
FROM python:3.12-slim

WORKDIR /app

# Устанавливаем зависимости для сборки (если понадобятся для некоторых библиотек)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements из корня или из папки backend (смотря где он у вас лежит)
# Судя по структуре, requirements.txt лежит в корне проекта
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходный код бэкенда
COPY backend/ ./backend/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Открываем порт FastAPI
EXPOSE 8000

# Запуск приложения (автоматически выполняем миграции Alembic перед стартом FastAPI)
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port 8000"]