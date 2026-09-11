# WhatsApp Web Edition

Web-based edition of the WhatsApp messaging lab application.

## Run Web Server

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm start
```

Open your browser at:
`http://localhost:3000/`

## Features
- Full WhatsApp Web dark UI
- Profile photo upload and real-time syncing
- Private WebSocket chat channels
- Standalone in-memory database with pre-seeded test accounts (Alice & Bob)
- Docker support via `docker compose up --build`
