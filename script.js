// 🔥 FLYNET — Готовый скрипт без ошибок
// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDkyiRV4s1mx-u0vXTFugt1VD_Ki7Sl7Sw",
  authDomain: "chat-29c7e.firebaseapp.com",
  projectId: "chat-29c7e",
  storageBucket: "chat-29c7e.firebasestorage.app",
  messagingSenderId: "191406446013",
  appId: "1:191406446013:web:a964c205dc0d2883ff6ed4"
};

// Initialize Firebase (Compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// State
let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let allUsers = [];

// DOM Elements
const authScreen = document.getElementById('auth');
const chatScreen = document.getElementById('chat');
const sidebar = document.getElementById('sidebar');
const messagesDiv = document.getElementById('messages');
const emojiPanel = document.getElementById('emojiPanel');
const settingsPanel = document.getElementById('settingsPanel');
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('chatTitle');
const messageInput = document.getElementById('messageInput');

// Auth Observer
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

// Ensure user exists in Firestore
async function ensureUserInDB(user) {
  const userRef = db.collection('users').doc(user.uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    await userRef.set({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || (user.email?.split('@')[0] || 'User'),
      photoURL: user.photoURL || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Load all other users
async function loadChats() {
  const snapshot = await db.collection('users').get();
  allUsers = [];
  snapshot.forEach(doc => {
    const u = doc.data();
    if (u.uid !== currentUser.uid) allUsers.push(u);
  });
  renderChatList();
}

// Render chat list
function renderChatList() {
  chatList.innerHTML = '';
  if (allUsers.length === 0) {
    chatList.innerHTML = '<div class="chat-item"><div class="chat-info"><div class="chat-name">Нет собеседников</div></div></div>';
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
        <div class="chat-last">${user.email}</div>
      </div>
    `;
    chatList.appendChild(div);
  });
}

// Open chat
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

// Send message
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

// Add reaction
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

// Auth Methods
async function signInWithGoogle() {
  try {
    await auth.signInWithPopup(provider);
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
    alert('Ошибка входа: ' + e.message);
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
    alert('Ошибка регистрации: ' + e.message);
  }
}

async function logout() {
  if (unsubscribeMessages) unsubscribeMessages();
  await auth.signOut();
}

// UI Controls
function showChats() {
  sidebar.classList.add('show');
}

function toggleEmojiPanel() {
  emojiPanel.classList.toggle('show');
  if (emojiPanel.classList.contains('show')) {
    settingsPanel.classList.remove('show');
  }
}

function openSettings() {
  settingsPanel.classList.add('show');
  emojiPanel.classList.remove('show');
}

function closeSettings() {
  settingsPanel.classList.remove('show');
}

// Emoji Panel
function initEmojiPanel() {
  const grid = document.getElementById('emojiGrid');
  const emojis = ['😀','😂','😍','🤔','😢','👍','❤️','🔥','🎉','🤩','😎','🤯','😭','🙏','👌','👀','💯','🚀'];
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

// Reaction Panel (inline)
const REACTION_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😃", "😅", "😆", "😉", "😊", "😋", "😎", "😍", "😘", "🥰", "😗", "🤔", 
  "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", 
  "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "🤓", "🧐", "😕", "🫤", 
  "😮", "😯", "😲", "😳", "🥺", "🥹", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", 
  "👹", "👺", "👻", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", 
  "🙈", "🙉", "🙊", "💋", "💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟", "❣️", "💔", "❤️", 
  "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣", 
  "💬", "🗨️"
];

// Make ALL functions globally accessible for HTML onclick
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.signInWithGoogle = signInWithGoogle;
window.sendMessage = sendMessage;
window.showChats = showChats;
window.toggleEmojiPanel = toggleEmojiPanel;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.logout = logout;
window.addReaction = addReaction;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initEmojiPanel();
});
