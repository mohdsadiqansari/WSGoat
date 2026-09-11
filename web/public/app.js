// WhatsApp Web Application Logic for WSGoat
let ws = null;
let profileWs = null;
let myUserId = null;
let myUserData = null;
let currentConversationId = null;
let currentRecipient = null;
let currentProfile = null;

const $ = id => document.getElementById(id);

// --- Avatar & Display Helpers ---
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#00a884", "#128c7e", "#029070", "#008069",
  "#25d366", "#34b7f1", "#4f46e5", "#7c3aed"
];

function getAvatarBg(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function setAvatarElement(el, name, avatarUrl) {
  if (!el) return;
  if (avatarUrl) {
    el.style.background = "transparent";
    el.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
  } else {
    el.style.background = getAvatarBg(name);
    el.textContent = getInitials(name);
  }
}

function showToast(message) {
  let container = $("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.25s ease";
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// --- API Wrapper ---
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin"
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

// --- Auth Tabs & Quick-Fill ---
function switchAuthTab(mode) {
  const isRegister = mode === "register";
  $("tabLogin").classList.toggle("active", !isRegister);
  $("tabRegister").classList.toggle("active", isRegister);
  
  $("fullNameGroup").style.display = isRegister ? "block" : "none";
  $("phoneGroup").style.display = isRegister ? "block" : "none";
  
  $("authSubmitBtn").textContent = isRegister ? "Register" : "Log In";
  $("authSubmitBtn").onclick = isRegister ? register : login;
  $("authStatus").textContent = "";
}

function fillDemo(user) {
  if (user === "alice") {
    $("username").value = "alice";
    $("password").value = "password123";
    $("fullName").value = "Alice Johnson";
    $("phone").value = "+1-555-0199";
  } else if (user === "bob") {
    $("username").value = "bob";
    $("password").value = "password123";
    $("fullName").value = "Bob Smith";
    $("phone").value = "+1-555-0188";
  }
  showToast(`Loaded ${user}'s test account`);
}

async function login() {
  const statusEl = $("authStatus");
  statusEl.textContent = "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value,
        password: $("password").value
      })
    });
    showApp(data);
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

async function register() {
  const statusEl = $("authStatus");
  statusEl.textContent = "";
  try {
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: $("username").value,
        password: $("password").value,
        full_name: $("fullName").value,
        phone: $("phone").value
      })
    });
    showApp(data);
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

// --- App State & Display ---
function showApp(data) {
  myUserId = data.id;
  myUserData = data;

  $("auth").style.display = "none";
  $("app").style.display = "block";

  // Backward compatibility targets
  if ($("me")) $("me").textContent = data.username;
  if ($("myCode")) $("myCode").textContent = data.userCode || data.user_code;

  // Header display
  $("myDisplayUsername").textContent = data.fullName || data.full_name || data.username;
  $("myDisplayCode").textContent = data.userCode || data.user_code || "--------";
  setAvatarElement($("myHeaderAvatar"), data.username, data.avatarUrl || data.avatar_url);

  // Sync drawer info
  refreshMyProfileDrawerUI();

  loadRecentChats();
  showToast(`Connected as @${data.username}`);
}

function copyMyCode() {
  const code = myUserData ? (myUserData.userCode || myUserData.user_code) : "";
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast(`Your Code (${code}) copied to clipboard`);
  }).catch(() => {
    showToast(`Your Code: ${code}`);
  });
}

function copyRecipientCode() {
  if (!currentRecipient || !currentRecipient.userCode) return;
  navigator.clipboard.writeText(currentRecipient.userCode).then(() => {
    showToast(`Recipient code (${currentRecipient.userCode}) copied`);
  });
}

// ==========================================================
// PROFILE PHOTO UPLOAD & MANAGEMENT (WhatsApp Style)
// ==========================================================
function openMyProfileDrawer() {
  refreshMyProfileDrawerUI();
  $("myProfileDrawer").classList.add("open");
}

function closeMyProfileDrawer() {
  $("myProfileDrawer").classList.remove("open");
}

function refreshMyProfileDrawerUI() {
  if (!myUserData) return;
  const displayName = myUserData.fullName || myUserData.full_name || myUserData.username;
  const avatarUrl = myUserData.avatarUrl || myUserData.avatar_url;
  const aboutText = myUserData.about || "Hey there! I am using WhatsApp.";
  const code = myUserData.userCode || myUserData.user_code || "--------";

  $("drawerMyFullName").textContent = displayName;
  $("drawerMyAbout").textContent = aboutText;
  $("drawerMyCode").textContent = code;

  const drawerAvatar = $("myDrawerAvatar");
  setAvatarElement(drawerAvatar, myUserData.username, avatarUrl);
}

function triggerPhotoUpload() {
  $("profilePhotoInput").click();
}

// Compress and upload image
function handlePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid image file");
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Scale image to a max dimension of 300x300 for optimal performance
      const canvas = document.createElement("canvas");
      const maxSize = 300;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      saveProfilePhoto(compressedDataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // Clear input so same file can be re-selected if needed
  event.target.value = "";
}

async function saveProfilePhoto(dataUrl) {
  try {
    const updated = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ avatar_url: dataUrl })
    });

    myUserData.avatarUrl = updated.avatar_url;
    myUserData.avatar_url = updated.avatar_url;

    // Update avatars across app
    setAvatarElement($("myHeaderAvatar"), myUserData.username, updated.avatar_url);
    refreshMyProfileDrawerUI();

    showToast("Profile photo updated successfully!");
  } catch (err) {
    showToast(err.message || "Failed to update profile photo");
  }
}

async function removeProfilePhoto() {
  try {
    const updated = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ avatar_url: "" })
    });

    myUserData.avatarUrl = "";
    myUserData.avatar_url = "";

    setAvatarElement($("myHeaderAvatar"), myUserData.username, "");
    refreshMyProfileDrawerUI();

    showToast("Profile photo removed");
  } catch (err) {
    showToast(err.message || "Failed to remove photo");
  }
}

async function editMyFullName() {
  const current = myUserData.fullName || myUserData.full_name || myUserData.username;
  const newName = prompt("Enter your name:", current);
  if (!newName || newName.trim() === "" || newName.trim() === current) return;

  try {
    const updated = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ full_name: newName.trim() })
    });

    myUserData.fullName = updated.full_name;
    myUserData.full_name = updated.full_name;
    $("myDisplayUsername").textContent = updated.full_name;
    $("drawerMyFullName").textContent = updated.full_name;
    showToast("Name updated");
  } catch (err) {
    showToast(err.message);
  }
}

async function editMyAbout() {
  const current = myUserData.about || "Hey there! I am using WhatsApp.";
  const newAbout = prompt("Enter your about status:", current);
  if (!newAbout || newAbout.trim() === "" || newAbout.trim() === current) return;

  try {
    const updated = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ about: newAbout.trim() })
    });

    myUserData.about = updated.about;
    $("drawerMyAbout").textContent = updated.about;
    showToast("About status updated");
  } catch (err) {
    showToast(err.message);
  }
}

// ==========================================================
// RECENT CONVERSATIONS (WhatsApp Style)
// ==========================================================
function getRecentKey() {
  return `wsgoat_recents_${myUserId}`;
}

function loadRecentChats() {
  const recentsList = $("sidebarRecentsList");
  if (!recentsList) return;

  let recents = [];
  try {
    recents = JSON.parse(localStorage.getItem(getRecentKey()) || "[]");
  } catch {
    recents = [];
  }

  if (recents.length === 0) {
    recentsList.innerHTML = `
      <div style="padding: 36px 20px; text-align: center; color: var(--wa-text-secondary); font-size: 13px;">
        <p>No chats yet.<br>Enter an 8-character recipient code above to chat.</p>
      </div>
    `;
    return;
  }

  recentsList.innerHTML = "";
  recents.forEach(chat => {
    const row = document.createElement("div");
    row.className = "wa-chat-row" + (currentConversationId === chat.conversationId ? " active" : "");
    row.onclick = () => connectWithCode(chat.userCode);

    row.innerHTML = `
      <div class="wa-row-avatar">
        <div class="wa-avatar" style="width: 49px; height: 49px; font-size: 16px;">
          ${chat.avatarUrl ? `<img src="${escapeHtml(chat.avatarUrl)}" alt="${escapeHtml(chat.username)}">` : getInitials(chat.username)}
        </div>
      </div>
      <div class="wa-row-details">
        <div class="wa-row-top">
          <span class="wa-row-name">${escapeHtml(chat.fullName || chat.username)}</span>
          <span class="wa-row-time">${chat.lastActive || ""}</span>
        </div>
        <div class="wa-row-bottom">
          <span class="wa-row-snippet">
            <span style="font-family: monospace; font-size: 11px; opacity: 0.7; color: var(--wa-green-primary);">[${escapeHtml(chat.userCode)}]</span>
            <span>${escapeHtml(chat.lastMessage || "Tap to chat")}</span>
          </span>
        </div>
      </div>
    `;
    recentsList.appendChild(row);
  });
}

function saveRecentChat(recipient, lastMsg = "") {
  if (!myUserId || !recipient || !recipient.userCode) return;
  try {
    let recents = JSON.parse(localStorage.getItem(getRecentKey()) || "[]");
    recents = recents.filter(c => c.userCode !== recipient.userCode);
    recents.unshift({
      username: recipient.username,
      fullName: recipient.fullName || recipient.full_name || recipient.username,
      userCode: recipient.userCode,
      avatarUrl: recipient.avatarUrl || recipient.avatar_url || "",
      conversationId: currentConversationId,
      lastMessage: lastMsg || "Connected",
      lastActive: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (recents.length > 25) recents = recents.slice(0, 25);
    localStorage.setItem(getRecentKey(), JSON.stringify(recents));
    loadRecentChats();
  } catch (err) {
    console.warn("Could not save recent chat", err);
  }
}

// ==========================================================
// RECIPIENT PROFILE DRAWER (Right Slide-in)
// ==========================================================
function toggleContactDrawer(forceState) {
  const drawer = $("contactDrawer");
  if (!drawer) return;
  if (typeof forceState === "boolean") {
    drawer.classList.toggle("open", forceState);
  } else {
    drawer.classList.toggle("open");
  }
}

function renderProfile(profile) {
  currentProfile = profile;

  // Compatibility targets
  if ($("profileName")) $("profileName").textContent = profile.full_name || profile.username;
  if ($("profileUserCode")) $("profileUserCode").textContent = profile.user_code || "";
  if ($("profileEmail")) {
    $("profileEmail").textContent = profile.email || "";
    if (profile.email) $("profileEmail").removeAttribute("hidden");
  }
  if ($("profilePhone")) $("profilePhone").textContent = profile.phone || "";

  // Contact Info Drawer targets
  $("drawerContactName").textContent = profile.full_name || profile.username;
  $("drawerContactUsername").textContent = `@${profile.username}`;
  $("drawerContactCode").textContent = profile.user_code || "--------";
  $("drawerContactPhone").textContent = profile.phone || "Not provided";
  $("drawerContactAbout").textContent = profile.about || "Hey there! I am using WhatsApp.";
  $("drawerContactEmail").textContent = profile.email || "Private (Lab Target)";

  // Update contact avatar
  setAvatarElement($("contactAvatarLarge"), profile.username, profile.avatar_url);
  setAvatarElement($("chatHeaderAvatar"), profile.username, profile.avatar_url);

  if ($("profileCard")) $("profileCard").style.display = "block";
}

function connectProfileSocket(recipientId) {
  if (profileWs) profileWs.close();

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  profileWs = new WebSocket(
    `${protocol}//${location.host}/ws/profile?userId=${recipientId}`
  );

  profileWs.onmessage = event => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "profile") {
        renderProfile(data.profile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  profileWs.onopen = () => {
    profileWs.send(JSON.stringify({
      action: "get_profile"
    }));
  };
}

// ==========================================================
// CHAT & MESSAGING
// ==========================================================
function setLocked(locked, statusText) {
  $("messageInput").disabled = locked;
  $("sendBtn").disabled = locked;
  $("blockBtn").disabled = locked;

  const bStatus = $("blockStatus");
  if (bStatus) {
    bStatus.textContent = statusText || "";
    bStatus.style.display = statusText ? "block" : "none";
  }

  const subStatus = $("recipientSubStatus");
  if (subStatus) {
    subStatus.textContent = locked ? "blocked" : "online";
    subStatus.style.color = locked ? "var(--wa-danger)" : "var(--wa-text-secondary)";
  }
}

function handleBlocked(blockedByUserId) {
  const iBlockedThem = Number(blockedByUserId) === Number(myUserId);
  setLocked(
    true,
    iBlockedThem
      ? "You blocked this contact."
      : "You have been blocked by this contact."
  );
}

async function blockCurrentUser() {
  if (!currentConversationId) return;

  const confirmed = confirm("Block this contact? Blocked contacts will no longer be able to send you messages.");
  if (!confirmed) return;

  try {
    await api(`/api/chats/${currentConversationId}/block`, { method: "POST" });
    handleBlocked(myUserId);
    showToast("Contact blocked");
  } catch (e) {
    showToast(e.message);
  }
}

function connectWithCode(code) {
  $("recipientCode").value = code;
  startChat();
}

async function startChat() {
  const recipientInput = $("recipientCode");
  const codeVal = recipientInput.value.trim().toUpperCase();

  if (!codeVal) {
    showToast("Please enter an 8-character recipient code");
    return;
  }

  try {
    if (ws) ws.close();
    if (profileWs) profileWs.close();

    setLocked(false, "");

    const data = await api("/api/chats", {
      method: "POST",
      body: JSON.stringify({ code: codeVal })
    });

    currentConversationId = data.conversationId;
    currentRecipient = data.recipient;

    // Header info
    $("chatHeaderUsername").textContent = data.recipient.fullName || data.recipient.username;
    $("recipientSubStatus").textContent = "online";
    setAvatarElement($("chatHeaderAvatar"), data.recipient.username, data.recipient.avatarUrl);

    // Profile WebSocket connection
    connectProfileSocket(data.recipient.id);

    // Load message history
    const history = await api(`/api/chats/${data.conversationId}/messages`);
    const messagesContainer = $("messages");
    messagesContainer.innerHTML = "";

    for (const message of history) {
      addMessage(message.username, message.body, message.created_at, message.avatar_url);
    }

    // Connect Chat WebSocket
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(
      `${protocol}//${location.host}/ws/${data.conversationId}`
    );

    ws.onopen = () => {
      $("chatStatus").textContent = "";
      $("blankChatView").style.display = "none";
      $("chat").style.display = "flex";
      $("mainChatPanel").classList.add("mobile-active");

      if (data.blockedBy) {
        handleBlocked(data.blockedBy);
      }

      saveRecentChat(data.recipient, history.length ? history[history.length - 1].body : "Connected");
      loadRecentChats();
      $("messageInput").focus();
    };

    ws.onmessage = event => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "blocked") {
          handleBlocked(msg.blockedBy);
          return;
        }

        if (msg.type === "system") {
          addSystemMessage(msg.message);
          return;
        }

        addMessage(msg.username, msg.body, msg.createdAt, msg.avatarUrl);
        saveRecentChat(currentRecipient, msg.body);
      } catch (err) {
        console.error(err);
      }
    };

    ws.onclose = () => {
      const sub = $("recipientSubStatus");
      if (sub) sub.textContent = "offline";
    };

    ws.onerror = () => {
      showToast("WebSocket error");
    };

  } catch (e) {
    showToast(e.message);
  }
}

function addMessage(username, body, createdAt, avatarUrl) {
  const messagesEl = $("messages");
  const isMe = myUserData && username === myUserData.username;

  const div = document.createElement("div");
  div.className = `message ${isMe ? 'sent' : 'received'}`;

  const timeStr = createdAt 
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="bubble-body">
      ${!isMe ? `<div class="bubble-sender">${escapeHtml(username)}</div>` : ''}
      <div class="bubble-text">${escapeHtml(body)}</div>
      <div class="bubble-meta">
        <span class="bubble-time">${timeStr}</span>
        ${isMe ? `
          <span class="bubble-ticks">
            <!-- Double checkmarks (WhatsApp blue ticks) -->
            <svg viewBox="0 0 16 15">
              <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"/>
            </svg>
          </span>
        ` : ''}
      </div>
    </div>
  `;

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMessage(text) {
  const messagesEl = $("messages");
  const div = document.createElement("div");
  div.className = "message system";
  div.innerHTML = `
    <div class="bubble-body">
      <span>${escapeHtml(text)}</span>
    </div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
  const input = $("messageInput");
  const body = input.value.trim();

  if (!body) return;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(body);
  } else {
    const sender = myUserData ? myUserData.username : "me";
    addMessage(sender, body, new Date());
    if (currentRecipient) {
      saveRecentChat(currentRecipient, body);
    }
  }

  input.value = "";
  input.focus();
}

function insertEmoji(emoji) {
  const input = $("messageInput");
  input.value += emoji + " ";
  input.focus();
}

function closeMobileChat() {
  $("mainChatPanel").classList.remove("mobile-active");
}

async function logout() {
  if (ws) ws.close();
  if (profileWs) profileWs.close();

  try {
    await api("/api/logout", { method: "POST" });
  } catch (err) {
    console.warn("Logout error", err);
  }

  currentConversationId = null;
  myUserId = null;
  myUserData = null;
  currentRecipient = null;

  $("app").style.display = "none";
  $("auth").style.display = "flex";
  $("chat").style.display = "none";
  $("blankChatView").style.display = "flex";
  closeMyProfileDrawer();
  toggleContactDrawer(false);
  setLocked(false, "");
  showToast("Logged out");
}

// Session Check
async function checkSession() {
  try {
    const user = await api("/api/me");
    if (user && user.id) {
      showApp({
        id: user.id,
        username: user.username,
        userCode: user.user_code,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        about: user.about
      });
    }
  } catch {
    // Show auth
  }
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  $("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  $("recipientCode").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      startChat();
    }
  });

  $("username").addEventListener("keydown", e => {
    if (e.key === "Enter") $("password").focus();
  });

  $("password").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      if ($("tabRegister").classList.contains("active")) {
        $("fullName").focus();
      } else {
        login();
      }
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeMyProfileDrawer();
      toggleContactDrawer(false);
    }
  });

  checkSession();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});

