# Home Poker Club

Веб-приложение для игры в Техасский Холдем.

## Быстрый старт

### Backend

```bash
cd HomePokerClub
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение будет доступно по адресу: http://localhost:5173

## Стек

- **Backend:** FastAPI + SQLite + treys
- **Frontend:** React + TypeScript + Vite + Zustand + Framer Motion

## Правила разработки

### UI-строки

Все видимые пользователю текстовые строки на фронтенде хранятся в файле `frontend/src/strings.ts` в объекте `S`. При добавлении новых строк (кнопки, заголовки, сообщения, плейсхолдеры и т.д.) **необходимо** добавлять их в этот файл и импортировать через `import { S } from '../../strings'`, а не хардкодить в компонентах.
