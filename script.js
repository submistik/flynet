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

// ... (остальной код без изменений, добавляем только функции для групп)

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

// ... (остальной код для ботов, auth и т.д.)
window.openCreateGroupModal = openCreateGroupModal;
window.closeCreateGroupModal = closeCreateGroupModal;
window.createGroup = createGroup;

// Load saved settings
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  changeTheme(savedTheme);
  themeSelect.value = savedTheme;
  // ... 
});