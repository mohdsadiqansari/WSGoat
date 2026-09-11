const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "development-only-secret";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
} else {
  console.log("[DB] No DATABASE_URL provided. Initializing in-memory PostgreSQL (pg-mem)...");
  const { newDb } = require("pg-mem");
  const db = newDb();
  const initSql = fs.readFileSync(path.join(__dirname, "..", "db", "init.sql"), "utf8");
  db.public.none(initSql);
  const pgAdapter = db.adapters.createPg();
  pool = new pgAdapter.Pool();

  // Pre-seed demo accounts alice and bob for instant testing
  (async () => {
    try {
      const hashAlice = await bcrypt.hash("password123", 10);
      const hashBob = await bcrypt.hash("password123", 10);
      await pool.query(
        `INSERT INTO users (username, password_hash, user_code, full_name, phone, email, avatar_url, about)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8), ($9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          "alice", hashAlice, "A1B2C3D4", "Alice Johnson", "+1-555-0199", "alice@wonderland.internal",
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
          "Hey there! I am using WhatsApp.",
          "bob", hashBob, "E5F6G7H8", "Bob Smith", "+1-555-0188", "bob@target-corp.internal",
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
          "Available for secure chat"
        ]
      );
      console.log("[DB] Pre-seeded test accounts: alice (code: A1B2C3D4) and bob (code: E5F6G7H8)");
    } catch (e) {
      console.error("[DB] Seeding error:", e.message);
    }
  })();
}

// Auto-run schema migrations on startup if running against external postgres
(async () => {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT DEFAULT 'Hey there! I am using WhatsApp.'");
  } catch (err) {
    // ignore if already present or in-memory
  }
})();

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authenticateRequest(req, res, next) {
  try {
    const token = req.cookies.auth;
    if (!token) return res.status(401).json({ error: "Authentication required" });

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function normalizePair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const result = await pool.query(
      "SELECT id, username, password_hash, user_code, full_name, phone, avatar_url, about FROM users WHERE username = $1",
      [username.trim()]
    );

    if (result.rowCount !== 1) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.cookie("auth", signToken(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: COOKIE_SECURE,
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({
      id: user.id,
      username: user.username,
      userCode: user.user_code,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      about: user.about
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Demo registration endpoint. Remove/disable in a real deployment if not needed.
app.post("/api/register", async (req, res) => {
  try {
    const {
      username,
      password,
      full_name,
      phone
    } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof full_name !== "string" ||
      typeof phone !== "string" ||
      !/^[a-zA-Z0-9_]{3,32}$/.test(username) ||
      password.length < 8 ||
      password.length > 128 ||
      full_name.trim().length < 1 ||
      full_name.trim().length > 100 ||
      phone.trim().length < 3 ||
      phone.trim().length > 30
    ) {
      return res.status(400).json({
        error: "Invalid registration data"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase();

    const result = await pool.query(
      `INSERT INTO users
        (username, password_hash, user_code, full_name, phone, about)
       VALUES ($1, $2, $3, $4, $5, 'Hey there! I am using WhatsApp.')
       RETURNING id, username, user_code, full_name, phone, avatar_url, about`,
      [
        username.trim(),
        passwordHash,
        userCode,
        full_name.trim(),
        phone.trim()
      ]
    );

    const user = result.rows[0];

    res.cookie("auth", signToken(user), {
      httpOnly: true,
      sameSite: "strict",
      secure: COOKIE_SECURE,
      maxAge: 8 * 60 * 60 * 1000
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      userCode: user.user_code,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      about: user.about
    });

  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Username already exists"
      });
    }

    console.error(err);
    res.status(500).json({
      error: "Internal server error"
    });
  }
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("auth");
  res.json({ ok: true });
});

app.get("/api/me", authenticateRequest, async (req, res) => {
  const result = await pool.query(
    "SELECT id, username, user_code, full_name, phone, email, avatar_url, about FROM users WHERE id = $1",
    [req.user.sub]
  );

  if (result.rowCount !== 1) {
    return res.status(401).json({ error: "User not found" });
  }

  res.json(result.rows[0]);
});

// Update Profile photo, about status, or name (WhatsApp style)
app.put("/api/profile", authenticateRequest, async (req, res) => {
  try {
    const { avatar_url, about, full_name } = req.body;
    const userId = Number(req.user.sub);

    const result = await pool.query(
      `UPDATE users
       SET avatar_url = COALESCE($1, avatar_url),
           about = COALESCE($2, about),
           full_name = COALESCE($3, full_name)
       WHERE id = $4
       RETURNING id, username, user_code, full_name, phone, email, avatar_url, about`,
      [avatar_url !== undefined ? avatar_url : null, about !== undefined ? about : null, full_name !== undefined ? full_name : null, userId]
    );

    if (result.rowCount !== 1) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = result.rows[0];

    // Push updated profile to any connected sockets
    const payload = JSON.stringify({
      type: "profile",
      profile: updated
    });
    wss.clients.forEach(client => {
      if (client.readyState === 1 && client.type === "profile" && client.requestedUserId === userId) {
        client.send(payload);
      }
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Enter recipient code -> create/reuse a private conversation.
app.post("/api/chats", authenticateRequest, async (req, res) => {
  const code = typeof req.body.code === "string"
    ? req.body.code.trim().toUpperCase()
    : "";

  if (!/^[A-F0-9]{8}$/.test(code)) {
    return res.status(400).json({ error: "Invalid user code" });
  }

  try {
    const recipientResult = await pool.query(
      "SELECT id, username, user_code, full_name, avatar_url, about FROM users WHERE user_code = $1",
      [code]
    );

    if (recipientResult.rowCount !== 1) {
      return res.status(404).json({ error: "User code not found" });
    }

    const recipient = recipientResult.rows[0];
    const me = Number(req.user.sub);

    if (Number(recipient.id) === me) {
      return res.status(400).json({ error: "You cannot chat with yourself" });
    }

    const [userA, userB] = normalizePair(me, Number(recipient.id));
    const conversationId = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO conversations (id, user_a_id, user_b_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_a_id, user_b_id)
       DO UPDATE SET user_a_id = conversations.user_a_id
       RETURNING id, blocked_by`,
      [conversationId, userA, userB]
    );

    res.json({
      conversationId: result.rows[0].id,
      blockedBy: result.rows[0].blocked_by,
      recipient: {
        id: recipient.id,
        username: recipient.username,
        userCode: recipient.user_code,
        fullName: recipient.full_name,
        avatarUrl: recipient.avatar_url,
        about: recipient.about
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/chats/:id/messages", authenticateRequest, async (req, res) => {
  const conversationId = req.params.id;

  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const result = await pool.query(
    `SELECT m.id, m.body, m.created_at, u.username, u.avatar_url
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = $1
       AND (c.user_a_id = $2 OR c.user_b_id = $2)
     ORDER BY m.id ASC
     LIMIT 200`,
    [conversationId, req.user.sub]
  );

  res.json(result.rows);
});

// Block the other participant in a conversation.
//
// NOTE (intentional lab bug): this endpoint updates the DB and pushes a
// "blocked" WebSocket event so connected clients can lock their UI, but it
// never inspects wss.clients to close or otherwise revoke the blocked
// user's already-open chat socket. The chat message handler further down
// only checks conversation membership, not blocked_by, so a socket that
// was open before the block keeps working until it happens to disconnect.
app.post("/api/chats/:id/block", authenticateRequest, async (req, res) => {
  const conversationId = req.params.id;

  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
    return res.status(400).json({ error: "Invalid conversation ID" });
  }

  const me = Number(req.user.sub);

  const result = await pool.query(
    `UPDATE conversations
     SET blocked_by = $2
     WHERE id = $1
       AND (user_a_id = $2 OR user_b_id = $2)
     RETURNING id`,
    [conversationId, me]
  );

  if (result.rowCount !== 1) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  // Tell any currently-connected sockets for this conversation so both
  // sides' UIs can lock immediately. This is advisory only — it does not
  // revoke the sockets themselves.
  const payload = JSON.stringify({
    type: "blocked",
    blockedBy: me,
    conversationId
  });

  wss.clients.forEach(client => {
    if (
      client.readyState === 1 &&
      client.type === "chat" &&
      client.conversationId === conversationId
    ) {
      client.send(payload);
    }
  });

  res.json({ ok: true });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Only users belonging to the requested conversation may upgrade.
server.on("upgrade", async (request, socket, head) => {
  try {
    const url = new URL(
      request.url,
      `http://${request.headers.host}`
    );

    if (url.pathname === "/ws/fullnames") {
      const requestedUserId =
        url.searchParams.get("userId");

      if (!/^\d+$/.test(requestedUserId || "")) {
        socket.destroy();
        return;
      }

      // INTENTIONALLY VULNERABLE:
      // requestedUserId is not checked against userId.
      const result = await pool.query(
        `SELECT
            id,
            username,
            user_code,
            full_name,
            phone
         FROM users
         WHERE id = $1`,
        [requestedUserId]
      );

      if (result.rowCount !== 1) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, ws => {
        ws.type = "profile";
        ws.userId = requestedUserId;
        ws.requestedUserId = Number(requestedUserId);
        ws.profile = result.rows[0];

        wss.emit("connection", ws, request);
      });

      return;
    }

    // Authenticate first
    const cookies = Object.fromEntries(
      (request.headers.cookie || "")
        .split(";")
        .filter(Boolean)
        .map(part => {
          const idx = part.indexOf("=");

          return [
            part.slice(0, idx).trim(),
            decodeURIComponent(part.slice(idx + 1).trim())
          ];
        })
    );

    if (!cookies.auth) {
      socket.destroy();
      return;
    }

    const token = jwt.verify(cookies.auth, JWT_SECRET);
    const userId = Number(token.sub);

    // =====================================================
    // PROFILE
    // =====================================================

    if (url.pathname === "/ws/profile") {
      const requestedUserId =
        url.searchParams.get("userId");

      if (!/^\d+$/.test(requestedUserId || "")) {
        socket.destroy();
        return;
      }

      // INTENTIONALLY VULNERABLE:
      // requestedUserId is not checked against userId.
      const result = await pool.query(
        `SELECT
            id,
            username,
            user_code,
            full_name,
            phone,
            avatar_url,
            about
         FROM users
         WHERE id = $1`,
        [requestedUserId]
      );

      if (result.rowCount !== 1) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, ws => {
        ws.type = "profile";
        ws.userId = userId;
        ws.requestedUserId = Number(requestedUserId);
        ws.profile = result.rows[0];

        wss.emit("connection", ws, request);
      });

      return;
    }

    // =====================================================
    // CHAT
    // =====================================================

    if (url.pathname.startsWith("/ws/")) {
      const conversationId =
        url.pathname.slice("/ws/".length);

      if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
        socket.destroy();
        return;
      }

      const membership = await pool.query(
        `SELECT id, blocked_by
         FROM conversations
         WHERE id = $1
           AND (user_a_id = $2 OR user_b_id = $2)`,
        [conversationId, userId]
      );

      if (membership.rowCount !== 1) {
        socket.destroy();
        return;
      }

      const { blocked_by } = membership.rows[0];

      // Minimal enforcement: only refuse *new* upgrades for the blocked
      // party. Sockets that were already open before the block was set
      // are intentionally left connected (see /api/chats/:id/block).
      if (blocked_by !== null && Number(blocked_by) !== userId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, ws => {
        ws.type = "chat";
        ws.userId = userId;
        ws.conversationId = conversationId;

        wss.emit("connection", ws, request);
      });

      return;
    }

    socket.destroy();

  } catch (err) {
    console.error(err);
    socket.destroy();
  }
});

// Each conversation has its own connected clients.
// Messages are never broadcast to unrelated conversations.
wss.on("connection", (ws) => {

  // ~ ================= ~
  // PROFILE WebSocket
  // =====================

  if (ws.type === "profile") {
    ws.send(JSON.stringify({
      type: "profile",
      profile: ws.profile
    }));

    ws.on("message", async raw => {
      try {
        const message = JSON.parse(raw.toString());

        if (message.action !== "get_profile") {
          return;
        }

        // Intentionally vulnerable: uses the attacker-controlled
        // requestedUserId rather than ws.userId.
        const result = await pool.query(
          `SELECT
              id,
              username,
              user_code,
              email,
              full_name,
              phone,
              avatar_url,
              about
           FROM users
           WHERE id = $1`,
          [ws.requestedUserId]
        );

        if (result.rowCount !== 1) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Profile not found"
          }));
          return;
        }

        ws.send(JSON.stringify({
          type: "profile",
          profile: result.rows[0]
        }));

      } catch {
        ws.send(JSON.stringify({
          type: "error",
          message: "Invalid message"
        }));
      }
    });

    return;
  }

  // ~ ============== ~
  // CHAT WebSocket
  // ==================

  ws.send(JSON.stringify({
    type: "system",
    message: "Connected to private conversation"
  }));

  ws.on("message", async raw => {
    try {
      const body = raw.toString();

      if (!body || body.length > 4000) return;

      // NOTE (intentional lab bug): membership is checked here, but
      // blocked_by is not. A socket opened before a block was set will
      // keep passing this check and keep sending/broadcasting messages.
      const membership = await pool.query(
        `SELECT id
         FROM conversations
         WHERE id = $1
           AND (user_a_id = $2 OR user_b_id = $2)`,
        [ws.conversationId, ws.userId]
      );

      if (membership.rowCount !== 1) {
        ws.close(1008, "Not a conversation participant");
        return;
      }

      const saved = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, body, created_at`,
        [ws.conversationId, ws.userId, body]
      );

      const sender = await pool.query(
        "SELECT username, avatar_url FROM users WHERE id = $1",
        [ws.userId]
      );

      const payload = JSON.stringify({
        type: "message",
        id: saved.rows[0].id,
        username: sender.rows[0].username,
        avatarUrl: sender.rows[0].avatar_url,
        body: saved.rows[0].body,
        createdAt: saved.rows[0].created_at
      });

      wss.clients.forEach(client => {
        if (
          client.readyState === 1 &&
          client.type === "chat" &&
          client.conversationId === ws.conversationId
        ) {
          client.send(payload);
        }
      });

    } catch (err) {
      console.error(err);
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTP/WebSocket server listening on port ${PORT}`);
});