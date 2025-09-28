import os
import json
import time
import requests
from firebase_admin import credentials, initialize_app, firestore

# Переменные окружения (Render)
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8372941288:AAF4KatHqafa7nfkK84FzGnBRSxXWe5cyj0")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "7700429042")
FIREBASE_CREDENTIALS_JSON = os.getenv("FIREBASE_CREDENTIALS_JSON")

if not FIREBASE_CREDENTIALS_JSON:
    raise ValueError("Требуется FIREBASE_CREDENTIALS_JSON в переменных окружения")

# Инициализация Firebase
cred_dict = json.loads(FIREBASE_CREDENTIALS_JSON)
cred = credentials.Certificate(cred_dict)
initialize_app(cred)
db = firestore.client()

def send_telegram_message(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload)
        print("✅ Уведомление отправлено")
    except Exception as e:
        print(f"❌ Ошибка Telegram: {e}")

def watch_new_users():
    print("🚀 FLYNET Bot запущен. Слежу за новыми пользователями...")
    seen_uids = set()
    while True:
        try:
            current_uids = {doc.id for doc in db.collection("users").stream()}
            new_uids = current_uids - seen_uids
            for uid in new_uids:
                user = db.collection("users").document(uid).get()
                if user.exists:
                    data = user.to_dict()
                    email = data.get("email", "не указан")
                    name = data.get("displayName", "Аноним")
                    is_anon = data.get("isAnonymous", False)
                    source = "Google" if data.get("photoURL") else ("Аноним" if is_anon else "Email")
                    msg = (
                        f"🆕 <b>Новый пользователь в FLYNET!</b>\n\n"
                        f"Имя: {name}\n"
                        f"Email: <code>{email}</code>\n"
                        f"Источник: {source}\n"
                        f"UID: <code>{uid}</code>"
                    )
                    send_telegram_message(msg)
            seen_uids = current_uids
            time.sleep(5)
        except Exception as e:
            print(f"❌ Ошибка Firestore: {e}")
            time.sleep(10)

if __name__ == "__main__":
    watch_new_users()
