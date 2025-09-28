# FLYNET — Облачный чат в стиле Telegram

## 🌐 Фронтенд
- Полностью клиентский (HTML + Firebase)
- Вход: Google, Email, Анонимно, Телефон
- Чаты слева, как в web.telegram.org
- Встроенный бот-помощник

## 🤖 Telegram-уведомления
При регистрации нового пользователя — вы получаете уведомление в Telegram.

### Как задеплоить бота на Render:
1. Создайте репозиторий на GitHub
2. Добавьте этот проект
3. Перейдите на [Render](https://render.com) → New → Web Service
4. Выберите папку `bot/`
5. Укажите:
   - **Start Command**: `python main.py`
   - **Environment**: Python 3.11
6. Добавьте переменные окружения:
   - `TELEGRAM_BOT_TOKEN` = ваш токен
   - `TELEGRAM_CHAT_ID` = ваш ID
   - `FIREBASE_CREDENTIALS_JSON` = содержимое JSON-файла от Firebase Admin

> ⚠️ Не коммитьте `serviceAccountKey.json` в GitHub!
