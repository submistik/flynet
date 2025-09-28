// 🔥 FLYNET — Исправленный скрипт с анонимным и телефонным входом
const firebaseConfig = {
  apiKey: "AIzaSyDkyiRV4s1mx-u0vXTFugt1VD_Ki7Sl7Sw",
  authDomain: "chat-29c7e.firebaseapp.com",
  projectId: "chat-29c7e",
  storageBucket: "chat-29c7e.firebasestorage.app",
  messagingSenderId: "191406446013",
  appId: "1:191406446013:web:a964c205dc0d2883ff6ed4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let allUsers = [];

// DOM
const authScreen = document.getElementById('auth');
const chatScreen = document.getElementById('chat');
const sidebar = document.getElementById('sidebar');
const messagesDiv = document.getElementById('messages');
const emojiPanel = document.getElementById('emojiPanel');
const settingsPanel = document.getElementById('settingsPanel');
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('chatTitle');
const messageInput = document.getElementById('messageInput');

auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await ensureUserInDB(user);
    loadChats();
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
  } else {
    currentUser = null;
    if (unsubscribeMessages) unsubscribeMessages();
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
  }
});

async function ensureUserInDB(user) {
  const userRef = db.collection('users').doc(user.uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    await userRef.set({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || (user.email?.split('@')[0] || 'User'),
      photoURL: user.photoURL || null,
      isAnonymous: user.isAnonymous || false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function loadChats() {
  const snapshot = await db.collection('users').get();
  allUsers = [];
  snapshot.forEach(doc => {
    const u = doc.data();
    if (u.uid !== currentUser.uid) allUsers.push(u);
  });
  renderChatList();
}

function renderChatList() {
  chatList.innerHTML = '';
  if (allUsers.length === 0) {
    chatList.innerHTML = '<div class="chat-item"><div class="chat-info"><div class="chat-name">Нет чатов</div></div></div>';
    return;
  }
  allUsers.forEach(user => {
    const chatId = [currentUser.uid, user.uid].sort().join('_');
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(chatId, user);
    const initial = (user.displayName || '?').charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="avatar">${initial}</div>
      <div class="chat-info">
        <div class="chat-name">${user.displayName}</div>
        <div class="chat-last">${user.isAnonymous ? 'Аноним' : user.email}</div>
      </div>
    `;
    chatList.appendChild(div);
  });
}

function openChat(chatId, user) {
  currentChatId = chatId;
  chatTitle.textContent = user.displayName;
  sidebar.classList.remove('show');
  if (unsubscribeMessages) unsubscribeMessages();

  const msgsRef = db.collection(`chats/${chatId}/messages`).orderBy('timestamp');
  unsubscribeMessages = msgsRef.onSnapshot((snapshot) => {
    messagesDiv.innerHTML = '';
    snapshot.forEach(doc => {
      const msg = doc.data();
      const isOut = msg.uid === currentUser.uid;
      const time = msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const div = document.createElement('div');
      div.className = `msg ${isOut ? 'out' : 'in'}`;
      let reactionsHtml = '';
      if (msg.reactions && Object.keys(msg.reactions).length > 0) {
        reactionsHtml = '<div class="reactions">';
        for (const [emoji, count] of Object.entries(msg.reactions)) {
          reactionsHtml += `<span class="reaction" onclick="addReaction('${doc.id}', '${emoji}')">${emoji} ${count}</span>`;
        }
        reactionsHtml += '</div>';
      }
      div.innerHTML = `
        ${msg.text}
        <div class="msg-time">${time}</div>
        ${reactionsHtml}
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentChatId) return;
  await db.collection(`chats/${currentChatId}/messages`).add({
    text,
    uid: currentUser.uid,
    reactions: {},
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  messageInput.value = '';
}

async function addReaction(msgId, emoji) {
  if (!currentChatId) return;
  const msgRef = db.collection(`chats/${currentChatId}/messages`).doc(msgId);
  const doc = await msgRef.get();
  if (!doc.exists) return;
  const msg = doc.data();
  const newReactions = { ...msg.reactions };
  newReactions[emoji] = (newReactions[emoji] || 0) + 1;
  await msgRef.update({ reactions: newReactions });
}

// === AUTH METHODS ===
async function signInAnonymously() {
  try {
    await auth.signInAnonymously();
  } catch (e) {
    alert('Ошибка анонимного входа: ' + e.message);
  }
}

async function signInWithPhone() {
  alert('⚠️ Вход по номеру требует:\n1. Включить Phone Auth в Firebase Console\n2. Настроить reCAPTCHA\n3. Добавить домен в белый список\n\nПока недоступен в демо.');
}

async function signInWithGoogle() {
  try {
    await auth.signInWithPopup(googleProvider);
  } catch (e) {
    alert('Ошибка Google: ' + e.message);
  }
}

async function handleLogin() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  if (!email || !pass) return alert('Заполните поля');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
}

async function handleRegister() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  if (!email || !pass || pass.length < 6) return alert('Пароль от 6 символов');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: email.split('@')[0] });
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
}

async function logout() {
  if (unsubscribeMessages) unsubscribeMessages();
  await auth.signOut();
}

// === UI ===
function showChats() {
  sidebar.classList.add('show');
}

function toggleEmojiPanel() {
  emojiPanel.classList.toggle('show');
  settingsPanel.classList.remove('show');
}

function openSettings() {
  settingsPanel.classList.add('show');
  emojiPanel.classList.remove('show');
}

function closeSettings() {
  settingsPanel.classList.remove('show');
}

function initEmojiPanel() {
  const grid = document.getElementById('emojiGrid');
  const emojis = ['😀','😂','😍','🤔','👍','❤️','🔥','👏','🤯','😢','🙏','👌'];
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji';
    span.textContent = emoji;
    span.onclick = () => {
      messageInput.value += emoji;
      messageInput.focus();
      toggleEmojiPanel();
    };
    grid.appendChild(span);
  });
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ (обязательно!) ===
window.signInAnonymously = signInAnonymously;
window.signInWithPhone = signInWithPhone;
window.signInWithGoogle = signInWithGoogle;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.sendMessage = sendMessage;
window.showChats = showChats;
window.toggleEmojiPanel = toggleEmojiPanel;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.addReaction = addReaction;

// Init
document.addEventListener('DOMContentLoaded', () => {
  initEmojiPanel();
});

// === FLYNET BOT (клиентский, без сервера) ===
function openBotChat() {
  currentChatId = 'flynet_bot_chat';
  document.getElementById('chatTitle').textContent = 'FLYNET Bot';
  document.getElementById('sidebar').classList.remove('show');
  
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = `
    <div class="msg in">
      👋 Привет! Я — <strong>FLYNET Bot</strong>.<br><br>
      Я помогу тебе освоиться в чате.<br><br>
      💡 Команды:<br>
      <strong>/start</strong> — приветствие<br>
      <strong>/help</strong> — список команд<br>
      <strong>/about</strong> — о создателе<br><br>
      👨‍💻 Владелец: <a href="https://t.me/ZeroOne_org" target="_blank" style="color:#568af2;">@ZeroOne_org</a>
    </div>
  `;
}

// Перехватываем отправку сообщений в чате с ботом
const originalSendMessage = window.sendMessage;
window.sendMessage = function() {
  if (currentChatId === 'flynet_bot_chat') {
    const input = document.getElementById('messageInput');
    const text = input.value.trim().toLowerCase();
    if (text) {
      // Покажем сообщение пользователя
      const userMsg = document.createElement('div');
      userMsg.className = 'msg out';
      userMsg.innerHTML = `${text}<div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
      document.getElementById('messages').appendChild(userMsg);
      
      // Ответим через 300 мс
      setTimeout(() => {
        let reply = '';
        if (text === '/start' || text.includes('привет') || text === 'hello') {
          reply = '👋 Привет! Я — FLYNET Bot. Напиши /help, чтобы увидеть команды.';
        } else if (text === '/help') {
          reply = 'Команды:\n/start — приветствие\n/help — эта помощь\n/about — о создателе';
        } else if (text === '/about') {
          reply = 'FLYNET создан разработчиком @ZeroOne_org.\n\nЭто облачный чат в стиле Telegram, полностью на Firebase.\n\nGitHub: github.com/submistik/flynet';
        } else {
          reply = 'Неизвестная команда. Напиши /help';
        }
        
        const botMsg = document.createElement('div');
        botMsg.className = 'msg in';
        botMsg.innerHTML = reply.replace(/\n/g, '<br>') + 
          `<div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
        document.getElementById('messages').appendChild(botMsg);
        document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
      }, 300);
      
      input.value = '';
    }
    return;
  }
  originalSendMessage();
};
