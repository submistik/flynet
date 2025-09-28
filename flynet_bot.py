# flynet_bot.py
import firebase_admin
from firebase_admin import credentials, firestore
import os
import time

# Инициализация Firebase Admin SDK
# Загрузите свой файл serviceAccountKey.json из Firebase Console → Project Settings → Service Accounts
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()
BOT_UID = "flynet_bot"
BOT_NAME = "FLYNET Bot"

def send_bot_message(chat_id: str, text: str):
    """Отправить сообщение от бота в чат"""
    db.collection(f"chats/{chat_id}/messages").add({
        "text": text,
        "uid": BOT_UID,
        "displayName": BOT_NAME,
        "photoURL": None,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "reactions": {}
    })

def on_new_user(user_doc):
    """Приветствовать нового пользователя"""
    user_uid = user_doc["uid"]
    chat_id = "_".join(sorted([user_uid, BOT_UID]))
    
    welcome_msg = (
        "👋 Привет! Я — FLYNET Bot.\n\n"
        "Я помогу тебе освоиться в чате.\n"
        "Напиши /help, чтобы увидеть команды.\n\n"
        "Создатель: @ZeroOne_org"
    )
    send_bot_message(chat_id, welcome_msg)
    print(f"Sent welcome to {user_uid}")

def watch_new_users():
    """Следить за новыми пользователями"""
    users_ref = db.collection("users")
    docs = users_ref.stream()
    seen_uids = set(doc.id for doc in docs)

    print("Bot started. Watching for new users...")
    while True:
        current_uids = set(doc.id for doc in users_ref.stream())
        new_uids = current_uids - seen_uids
        for uid in new_uids:
            user_doc = users_ref.document(uid).get().to_dict()
            if user_doc:
                on_new_user(user_doc)
        seen_uids = current_uids
        time.sleep(5)

if __name__ == "__main__":
    watch_new_users()
