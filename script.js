import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  setDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDkyiRV4s1mx-u0vXTFugt1VD_Ki7Sl7Sw",
  authDomain: "chat-29c7e.firebaseapp.com",
  projectId: "chat-29c7e",
  storageBucket: "chat-29c7e.firebasestorage.app",
  messagingSenderId: "191406446013",
  appId: "1:191406446013:web:a964c205dc0d2883ff6ed4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Global state
let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;
let allUsers = [];
let allChats = [];

// DOM elements
const authScreen = document.getElementById("auth");
const chatScreen = document.getElementById("chat");
const sidebar = document.getElementById("sidebar");
const mainChat = document.getElementById("mainChat");
const messagesDiv = document.getElementById("messages");
const emojiPanel = document.getElementById("emojiPanel");
const settingsPanel = document.getElementById("settingsPanel");
const botsPanel = document.getElementById("botsPanel");
const chatList = document.getElementById("chatList");
const chatTitle = document.getElementById("chatTitle");
const messageInput = document.getElementById("messageInput");
const themeSelect = document.getElementById("themeSelect");
const bgColorPicker = document.getElementById("bgColorPicker");
const textColorPicker = document.getElementById("textColorPicker");
const accentColorPicker = document.getElementById("accentColorPicker");
const botList = document.getElementById("botList");
const createGroupModal = document.getElementById("createGroupModal");
const groupNameInput = document.getElementById("groupName");
const userListForGroup = document.getElementById("userListForGroup");

// Initialize
onAuthStateChanged(auth, async (user) => {
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
  const userRef = doc(db, "users", user.uid);
  const snap = await getDocs(
    query(collection(db, "users"), where("uid", "==", user.uid)),
  );
  if (snap.empty) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split("@")[0] || "User",
      photoURL: user.photoURL || null,
      timestamp: serverTimestamp(),
    });
  }
}

// Load chats
async function loadChats() {
  const chatsSnap = await getDocs(query(collection(db, "chats"), where("members", "array-contains", currentUser.uid)));
  allChats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  allUsers = await getAllUsers();
  renderChatList();
}

async function getAllUsers() {
  const usersSnap = await getDocs(collection(db, "users"));
  return usersSnap.docs.map(doc => doc.data()).filter(u => u.uid !== currentUser.uid);
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

  const msgsRef = collection(db, "chats", chatId, "messages");
  const q = query(msgsRef, orderBy("timestamp"));
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
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
  const msgsRef = collection(db, "chats", currentChatId, "messages");
  await addDoc(msgsRef, {
    text,
    uid: currentUser.uid,
    timestamp: serverTimestamp(),
  });
  messageInput.value = "";
}

async function sendMedia(event) {
  const file = event.target.files[0];
  if (!file || !currentChatId) return;
  const storageRef = ref(storage, `messages/${currentChatId}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  const msgsRef = collection(db, "chats", currentChatId, "messages");
  await addDoc(msgsRef, {
    media: { type: file.type.startsWith('image/') ? 'image' : 'video', url },
    uid: currentUser.uid,
    timestamp: serverTimestamp(),
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
  const chatRef = await addDoc(collection(db, "chats"), {
    type: 'group',
    name,
    members,
    timestamp: serverTimestamp(),
  });
  closeCreateGroupModal();
  loadChats();
}

async function loadBots() {
  const botsRef = collection(db, "users", currentUser.uid, "bots");
  onSnapshot(botsRef, (snapshot) => {
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
  const botsRef = collection(db, "users", currentUser.uid, "bots");
  await addDoc(botsRef, {
    name,
    description,
    token,
    createdAt: serverTimestamp(),
  });
  document.getElementById("botName").value = "";
  document.getElementById("botDescription").value = "";
  alert("Бот создан! Используйте токен для подключения на вашем сайте.");
}

async function deleteBot(botId) {
  if (confirm("Удалить бота?")) {
    await deleteDoc(doc(db, "users", currentUser.uid, "bots", botId));
  }
}

function changeTheme(theme) {
  console.log("Changing theme to:", theme); // Debug
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
  await signOut(auth);
}

async function deleteAccount() {
  if (confirm("Вы уверены?")) {
    try {
      await deleteUser(auth.currentUser);
      alert("Аккаунт удалён.");
      await signOut(auth);
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
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    alert(e.message);
  }
}

async function handleRegister() {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  if (!email || !pass || pass.length < 6) return alert("Неверный пароль");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: email.split("@")[0] });
  } catch (e) {
    alert(e.message);
  }
}

async function signInWithGoogle() {
  console.log("Attempting Google sign-in"); // Debug
  try {
    await signInWithPopup(auth, provider);
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

// Global function assignments
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.signInWithGoogle = signInWithGoogle;
window.sendMessage = sendMessage;
window.sendMedia = sendMedia;
window.showChats = showChats;
window.toggleEmojiPanel = toggleEmojiPanel;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openBots = openBots;
window.closeBots = closeBots;
window.createGroup = createGroup;
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.logout = logout;
window.deleteAccount = deleteAccount;
window.changeTheme = changeTheme;
window.changeBgColor = changeBgColor;
window.changeTextColor = changeTextColor;
window.changeAccentColor = changeAccentColor;
window.createBot = createBot;
window.deleteBot = deleteBot;

console.log("Script loaded, functions assigned:", {
  changeTheme: typeof window.changeTheme,
  signInWithGoogle: typeof window.signInWithGoogle,
}); // Debug

// Load saved settings
window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded"); // Debug
  const savedTheme = localStorage.getItem("theme") || "dark";
  changeTheme(savedTheme);
  themeSelect.value = savedTheme;
  const savedBgColor = localStorage.getItem("bgColor");
  if (savedBgColor) changeBgColor(savedBgColor);
  const savedTextColor = localStorage.getItem("textColor");
  if (savedTextColor) changeTextColor(savedTextColor);
  const savedAccentColor = localStorage.getItem("accentColor");
  if (savedAccentColor) changeAccentColor(savedAccentColor);
  initEmojiPanel();
});
