// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDkyiRV4s1mx-u0vXTFugt1VD_Ki7Sl7Sw",
  authDomain: "chat-29c7e.firebaseapp.com",
  projectId: "chat-29c7e",
  storageBucket: "chat-29c7e.firebasestorage.app",
  messagingSenderId: "191406446013",
  appId: "1:191406446013:web:a964c205dc0d2883ff6ed4",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let allUsers = [];

// DOM
let authScreen, chatScreen, sidebar, messagesDiv, emojiPanel, settingsPanel, chatList, chatTitle;

function initDOM() {
  authScreen = document.getElementById('auth');
  chatScreen = document.getElementById('chat');
  sidebar = document.getElementById('sidebar');
  messagesDiv = document.getElementById('messages');
  emojiPanel = document.getElementById('emojiPanel');
  settingsPanel = document.getElementById('settingsPanel');
  chatList = document.getElementById('chatList');
  chatTitle = document.getElementById('chatTitle');
}

// Auth state
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
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL || null,
      isAnonymous: user.isAnonymous || false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function loadChats() {
  const usersSnap = await db.collection('users').get();
  allUsers = [];
  usersSnap.forEach(doc => {
    const u = doc.data();
    if (u.uid !== currentUser.uid) allUsers.push(u);
  });
  renderChatList();
}

function renderChatList() {
  chatList.innerHTML = '';
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
      div.innerHTML = `
        ${msg.text}
        <div class="msg-time">${time}</div>
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !currentChatId) return;
  await db.collection(`chats/${currentChatId}/messages`).add({
    text,
    uid: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  input.value = '';
}

// Auth Methods
async function signInAnonymously() {
  try {
    await auth.signInAnonymously();
  } catch (e) { alert(e.message); }
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (e) { alert(e.message); }
}

async function signInWithPhone() {
  alert('Вход по номеру — требует настройки reCAPTCHA и верификации. Включите в Firebase Console → Authentication → Phone.');
}

async function handleLogin() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  if (!email || !pass) return alert('Заполните поля');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) { alert(e.message); }
}

async function handleRegister() {
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  if (!email || !pass || pass.length < 6) return alert('Пароль минимум 6 символов');
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: email.split('@')[0] });
  } catch (e) { alert(e.message); }
}

async function logout() {
  if (unsubscribeMessages) unsubscribeMessages();
  await auth.signOut();
}

// UI
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

function initEmojiPanel() {
  const grid = document.getElementById('emojiGrid');
  const emojis = ['😀','😂','😍','🤔','😢','👍','❤️','🔥','🎉','🤩','😎','🤯','😭','🙏','👌','👀','💯','🚀'];
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji';
    span.textContent = emoji;
    span.onclick = () => {
      document.getElementById('messageInput').value += emoji;
      document.getElementById('messageInput').focus();
      toggleEmojiPanel();
    };
    grid.appendChild(span);
  });
}

// Make functions global
window.signInAnonymously = signInAnonymously;
window.signInWithGoogle = signInWithGoogle;
window.signInWithPhone = signInWithPhone;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.sendMessage = sendMessage;
window.showChats = showChats;
window.toggleEmojiPanel = toggleEmojiPanel;
window.openSettings = openSettings;
window.closeSettings = closeSettings;

// Init
document.addEventListener('DOMContentLoaded', () => {
  initDOM();
  initEmojiPanel();
});
