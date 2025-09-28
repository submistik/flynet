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
const storage = firebase.storage();
const provider = new firebase.auth.GoogleAuthProvider();

// Global state
let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let allUsers = [];
let allChats = [];

// DOM elements (wait for DOM ready)
let authScreen, chatScreen, sidebar, mainChat, messagesDiv, emojiPanel, settingsPanel, botsPanel, chatList, chatTitle, messageInput, themeSelect, bgColorPicker, textColorPicker, accentColorPicker, botList, createGroupModal, groupNameInput, userListForGroup;

function initDOM() {
  authScreen = document.getElementById("auth");
  chatScreen = document.getElementById("chat");
  sidebar = document.getElementById("sidebar");
  mainChat = document.getElementById("mainChat");
  messagesDiv = document.getElementById("messages");
  emojiPanel = document.getElementById("emojiPanel");
  settingsPanel = document.getElementById("settingsPanel");
  botsPanel = document.getElementById("botsPanel");
  chatList = document.getElementById("chatList");
  chatTitle = document.getElementById("chatTitle");
  messageInput = document.getElementById("messageInput");
  themeSelect = document.getElementById("themeSelect");
  bgColorPicker = document.getElementById("bgColorPicker");
  textColorPicker = document.getElementById("textColorPicker");
  accentColorPicker = document.getElementById("accentColorPicker");
  botList = document.getElementById("botList");
  createGroupModal = document.getElementById("createGroupModal");
  groupNameInput = document.getElementById("groupName");
  userListForGroup = document.getElementById("userListForGroup");
}

// Auth state observer
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await ensureUserInDB(user);
    loadChats();
    loadBots();
    authScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
  } else {
    currentUser = null;
    if (unsubscribeMessages) unsubscribeMessages();
    authScreen.classList.remove("hidden");
    chatScreen.classList.add("hidden");
  }
});

// Ensure user in DB
async function ensureUserInDB(user) {
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set({
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      photoURL: user.photoURL || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
}

// Load chats
async function loadChats() {
  const chatsSnap = await db.collection("chats").where("members", "array-contains", currentUser.uid).get();
  allChats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const usersSnap = await db.collection("users").get();
  allUsers = usersSnap.docs.map(doc => doc.data()).filter(u => u.uid !== currentUser.uid);
  renderChatList();
}

function renderChatList() {
  chatList.innerHTML = "";
  allChats.forEach((chat) => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.onclick = () => openChat(chat.id, chat);
    const title = chat.type === 'group' ? chat.name : getChatUser(chat.members).displayName;
    const initial = title.charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="avatar">${initial}</div>
      <div class="chat-info">
        <div class="chat-name">${title}</div>
        <div class="chat-last">Последнее сообщение...</div>
      </div>
    `;
    chatList.appendChild(div);
  });
}

function getChatUser(members) {
  const otherUid = members.find(uid => uid !== currentUser.uid);
  return allUsers.find(u => u.uid === otherUid) || { displayName: 'Unknown' };
}

function openChat(chatId, chat) {
  currentChatId = chatId;
  const title = chat.type === 'group' ? chat.name : getChatUser(chat.members).displayName;
  chatTitle.textContent = title;
  sidebar.classList.remove("show");
  if (unsubscribeMessages) unsubscribeMessages();

  const msgsRef = db.collection(`chats/${chatId}/messages`).orderBy("timestamp");
  unsubscribeMessages = msgsRef.onSnapshot((snapshot) => {
    messagesDiv.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const isOut = msg.uid === currentUser.uid;
      const div = document.createElement("div");
      div.className = `msg ${isOut ? "out" : "in"}`;
      div.innerHTML = `
        ${msg.text}
        <div class="msg-time">${msg.timestamp?.toDate().toLocaleTimeString()}</div>
      `;
      messagesDiv.appendChild(div);
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentChatId) return;
  const msgsRef = db.collection(`chats/${currentChatId}/messages`);
  await msgsRef.add({
    text,
    uid: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
  messageInput.value = "";
}

async function sendMedia(event) {
  const file = event.target.files[0];
  if (!file || !currentChatId) return;
  const storageRef = storage.ref(`messages/${currentChatId}/${Date.now()}_${file.name}`);
  await storageRef.put(file);
  const url = await storageRef.getDownloadURL();
  const msgsRef = db.collection(`chats/${currentChatId}/messages`);
  await msgsRef.add({
    media: { type: file.type.startsWith('image/') ? 'image' : 'video', url },
    uid: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
  event.target.value = "";
}

function openCreateGroupModal() {
  userListForGroup.innerHTML = "";
  allUsers.forEach((user) => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <input type="checkbox" value="${user.uid}">
      ${user.displayName}
    `;
    userListForGroup.appendChild(div);
  });
  createGroupModal.classList.remove("hidden");
}

function closeCreateGroupModal() {
  createGroupModal.classList.add("hidden");
}

async function createGroup() {
  const name = groupNameInput.value.trim();
  if (!name) return alert("Введите название группы");
  const selectedUids = Array.from(userListForGroup.querySelectorAll('input:checked')).map(input => input.value);
  const members = [currentUser.uid, ...selectedUids];
  if (members.length < 3) return alert("Выберите хотя бы одного пользователя");
  await db.collection("chats").add({
    type: 'group',
    name,
    members,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
  closeCreateGroupModal();
  loadChats();
}

async function loadBots() {
  const botsRef = db.collection(`users/${currentUser.uid}/bots`);
  botsRef.onSnapshot((snapshot) => {
    const userBots = [];
    snapshot.forEach((doc) => {
      userBots.push({ id: doc.id, ...doc.data() });
    });
    renderBotList(userBots);
  });
}

function renderBotList(bots) {
  botList.innerHTML = "";
  bots.forEach((bot) => {
    const div = document.createElement("div");
    div.className = "bot-item";
    div.innerHTML = `
      <h4>${bot.name}</h4>
      <p>${bot.description}</p>
      <p><strong>Токен:</strong> <code>${bot.token}</code></p>
      <p><strong>Webhook:</strong> https://your-site.com/webhook/${bot.token}</p>
      <button onclick="deleteBot('${bot.id}')">Удалить</button>
    `;
    botList.appendChild(div);
  });
}

async function createBot() {
  const name = document.getElementById("botName").value.trim();
  const description = document.getElementById("botDescription").value.trim();
  if (!name) return alert("Введите имя бота");
  const token = crypto.randomUUID();
  const botsRef = db.collection(`users/${currentUser.uid}/bots`);
  await botsRef.add({
    name,
    description,
    token,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  document.getElementById("botName").value = "";
  document.getElementById("botDescription").value = "";
  alert("Бот создан! Используйте токен для подключения на вашем сайте.");
}

async function deleteBot(botId) {
  if (confirm("Удалить бота?")) {
    await db.collection(`users/${currentUser.uid}/bots`).doc(botId).delete();
  }
}

function changeTheme(theme) {
  console.log("Theme changed to:", theme);
  document.body.className = theme === "light" ? "theme-light" : theme === "blue" ? "theme-blue" : "theme-dark";
  localStorage.setItem("theme", theme);
}

function changeBgColor(color) {
  document.documentElement.style.setProperty("--bg-color", color);
  localStorage.setItem("bgColor", color);
}

function changeTextColor(color) {
  document.documentElement.style.setProperty("--text-color", color);
  localStorage.setItem("textColor", color);
}

function changeAccentColor(color) {
  document.documentElement.style.setProperty("--accent-text-color", color);
  localStorage.setItem("accentColor", color);
}

async function logout() {
  if (unsubscribeMessages) unsubscribeMessages();
  await auth.signOut();
}

async function deleteAccount() {
  if (confirm("Вы уверены?")) {
    try {
      await currentUser.delete();
      alert("Аккаунт удалён.");
      await auth.signOut();
    } catch (error) {
      alert("Ошибка: " + error.message);
    }
  }
}

async function handleLogin() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  if (!email || !pass) return alert("Заполните поля");
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    alert(e.message);
  }
}

async function handleRegister() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  if (!email || !pass || pass.length < 6) return alert("Неверный пароль");
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: email.split("@")[0] });
  } catch (e) {
    alert(e.message);
  }
}

async function signInWithGoogle() {
  console.log("Google sign-in initiated");
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    alert(e.message);
  }
}

function initEmojiPanel() {
  const grid = document.getElementById("emojiGrid");
  const emojis = ["😀", "😂", "😍", "🤔", "😢", "👍", "❤️", "🔥"];
  emojis.forEach((emoji) => {
    const span = document.createElement("span");
    span.className = "emoji";
    span.textContent = emoji;
    span.onclick = () => {
      messageInput.value += emoji;
      messageInput.focus();
      toggleEmojiPanel();
    };
    grid.appendChild(span);
  });
}

function toggleEmojiPanel() {
  emojiPanel.classList.toggle("show");
  if (emojiPanel.classList.contains("show")) {
    settingsPanel.classList.remove("show");
    botsPanel.classList.remove("show");
  }
}

function openSettings() {
  settingsPanel.classList.add("show");
  emojiPanel.classList.remove("show");
  botsPanel.classList.remove("show");
}

function closeSettings() {
  settingsPanel.classList.remove("show");
}

function openBots() {
  botsPanel.classList.add("show");
  emojiPanel.classList.remove("show");
  settingsPanel.classList.remove("show");
}

function closeBots() {
  botsPanel.classList.remove("show");
}

function showChats() {
  sidebar.classList.add("show");
}

// Инициализация при загрузке DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing app");
  initDOM();
  const savedTheme = localStorage.getItem("theme") || "dark";
  changeTheme(savedTheme);
  if (themeSelect) themeSelect.value = savedTheme;
  const savedBgColor = localStorage.getItem("bgColor");
  if (savedBgColor) changeBgColor(savedBgColor);
  const savedTextColor = localStorage.getItem("textColor");
  if (savedTextColor) changeTextColor(savedTextColor);
  const savedAccentColor = localStorage.getItem("accentColor");
  if (savedAccentColor) changeAccentColor(savedAccentColor);
  initEmojiPanel();
  console.log("Functions ready:", { changeTheme: typeof changeTheme, signInWithGoogle: typeof signInWithGoogle });
});
