// bot.js
// Слушает системные сообщения от бота и отображает их в активном чате

const BOT_UID = 'flynet_bot';
const BOT_NAME = 'FLYNET Bot';
const BOT_AVATAR = '🤖';

// Добавим бота в список чатов при загрузке
document.addEventListener('DOMContentLoaded', () => {
  // Ждём, пока загрузится основной скрипт и появится currentUser
  const checkBotReady = setInterval(() => {
    if (typeof currentUser !== 'undefined' && currentUser) {
      clearInterval(checkBotReady);
      ensureBotInChatList();
    }
  }, 500);
});

function ensureBotInChatList() {
  // Добавим бота вручную в список чатов (без записи в Firestore)
  const botChatId = [currentUser.uid, BOT_UID].sort().join('_');
  
  // Проверим, есть ли уже чат с ботом
  if (!document.querySelector(`[data-chat-id="${botChatId}"]`)) {
    const chatList = document.getElementById('chatList');
    if (chatList) {
      const div = document.createElement('div');
      div.className = 'chat-item';
      div.dataset.chatId = botChatId;
      div.innerHTML = `
        <div class="avatar">${BOT_AVATAR}</div>
        <div class="chat-info">
          <div class="chat-name">${BOT_NAME}</div>
          <div class="chat-last">Помощник FLYNET</div>
        </div>
      `;
      div.onclick = () => openBotChat(botChatId);
      chatList.insertBefore(div, chatList.firstChild); // в начало списка
    }
  }
}

function openBotChat(chatId) {
  // Откроем чат с ботом
  currentChatId = chatId;
  document.getElementById('chatTitle').textContent = BOT_NAME;
  document.getElementById('sidebar').classList.remove('show');

  // Очистим сообщения и покажем приветствие
  const messagesDiv = document.getElementById('messages');
  messagesDiv.innerHTML = `
    <div class="msg in">
      Привет! 👋 Я — FLYNET Bot.<br>
      Я помогу тебе освоиться.<br><br>
      Команды:<br>
      <strong>/start</strong> — приветствие<br>
      <strong>/help</strong> — помощь<br>
      <strong>/about</strong> — о создателе<br><br>
      Владелец: <a href="https://t.me/ZeroOne_org" target="_blank">@ZeroOne_org</a>
    </div>
  `;
}

// Обработка команд (если пользователь пишет в чат с ботом)
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('messageInput');
  if (input) {
    const originalSend = window.sendMessage;
    window.sendMessage = function() {
      if (currentChatId?.includes('flynet_bot')) {
        const text = input.value.trim().toLowerCase();
        handleBotCommand(text);
        input.value = '';
        return;
      }
      originalSend();
    };
  }
});

function handleBotCommand(cmd) {
  const messagesDiv = document.getElementById('messages');
  let reply = '';

  if (cmd === '/start' || cmd === 'привет' || cmd === 'hello') {
    reply = `Привет! 👋 Я — FLYNET Bot.\n\nНапиши /help, чтобы увидеть команды.`;
  } else if (cmd === '/help') {
    reply = `Команды:\n/start — приветствие\n/help — эта помощь\n/about — о создателе`;
  } else if (cmd === '/about') {
    reply = `FLYNET создан разработчиком @ZeroOne_org.\n\nЭто облачный чат в стиле Telegram, полностью на Firebase.\n\nGitHub: github.com/submistik/flynet`;
  } else {
    reply = `Неизвестная команда.\nНапиши /help`;
  }

  const div = document.createElement('div');
  div.className = 'msg in';
  div.innerHTML = reply.replace(/\n/g, '<br>');
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
