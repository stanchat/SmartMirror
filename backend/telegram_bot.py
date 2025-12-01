#!/usr/bin/env python3
"""
Telegram Bot for SmartMirror - Barber Mirror Assistant
Uses PostgreSQL database for persistence.
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db_client as db

TELEGRAM_LOG_FILE = os.path.join(os.path.dirname(__file__), "telegram_log.json")

HIDDEN_COMMANDS = {'/start', '/help', '/today', '/earnings', '/menu', '/cancel'}

SLOT_TO_TIME = {
    "slot_0900": "9:00 AM",
    "slot_1000": "10:00 AM",
    "slot_1100": "11:00 AM",
    "slot_1200": "12:00 PM",
    "slot_1300": "1:00 PM",
    "slot_1400": "2:00 PM",
    "slot_1500": "3:00 PM",
    "slot_1600": "4:00 PM",
    "slot_1700": "5:00 PM"
}

TIME_TO_SLOT = {v: k for k, v in SLOT_TO_TIME.items()}

def is_hidden_message(text):
    if not text:
        return False
    text_lower = text.lower().strip()
    if text_lower in HIDDEN_COMMANDS or text_lower.startswith('/'):
        return True
    return False

async def log_message_to_db(sender, text, chat_id):
    """Log message to database."""
    try:
        await db.log_message(chat_id, sender, text)
    except Exception as e:
        print(f"Error logging message to DB: {e}")
    
    log_entry = {
        "id": int(datetime.now().timestamp() * 1000),
        "timestamp": datetime.now().isoformat(),
        "sender": sender,
        "text": text,
        "chat_id": chat_id,
        "isNew": True
    }
    try:
        logs = []
        if os.path.exists(TELEGRAM_LOG_FILE):
            with open(TELEGRAM_LOG_FILE, 'r') as f:
                logs = json.load(f)
        logs.insert(0, log_entry)
        logs = logs[:100]
        with open(TELEGRAM_LOG_FILE, 'w') as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        print(f"Error logging to file: {e}")
    
    return log_entry

def get_main_menu():
    keyboard = [
        [InlineKeyboardButton("📅 Today's Appointments", callback_data="appointments")],
        [InlineKeyboardButton("📊 Financial Tracking", callback_data="financial")],
        [InlineKeyboardButton("👥 Customer History", callback_data="customers")],
        [InlineKeyboardButton("📺 Mirror Controls", callback_data="mirror_controls")],
        [InlineKeyboardButton("💬 Send Message to Mirror", callback_data="send_message")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_financial_menu():
    keyboard = [
        [InlineKeyboardButton("💰 Record Sale", callback_data="record_sale")],
        [InlineKeyboardButton("📈 Today's Earnings", callback_data="today_earnings")],
        [InlineKeyboardButton("📊 Weekly Progress", callback_data="weekly_progress")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_mirror_controls_menu():
    keyboard = [
        [InlineKeyboardButton("👁️ Detect Face", callback_data="cmd_detect_face")],
        [InlineKeyboardButton("📋 Show Appointments", callback_data="cmd_show_appointments")],
        [InlineKeyboardButton("🌤️ Show Weather", callback_data="cmd_show_weather")],
        [InlineKeyboardButton("📰 Show News", callback_data="cmd_show_news")],
        [InlineKeyboardButton("🔄 Clear Display", callback_data="cmd_clear")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_appointments_menu():
    keyboard = [
        [InlineKeyboardButton("📋 View Today", callback_data="view_today")],
        [InlineKeyboardButton("➕ Book Appointment", callback_data="book_appointment")],
        [InlineKeyboardButton("❌ Cancel Appointment", callback_data="cancel_appointment")],
        [InlineKeyboardButton("⏰ Running Late Alert", callback_data="running_late")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

async def get_service_menu():
    """Build service menu dynamically from database."""
    try:
        services = await db.get_services(active_only=True)
        keyboard = []
        for svc in services:
            price = svc['price_cents'] / 100
            btn_text = f"✂️ {svc['name']} - ${price:.0f}"
            keyboard.append([InlineKeyboardButton(btn_text, callback_data=f"svc_{svc['id']}")])
        keyboard.append([InlineKeyboardButton("🔙 Back", callback_data="appointments")])
        return InlineKeyboardMarkup(keyboard)
    except Exception as e:
        print(f"Error loading services: {e}")
        keyboard = [
            [InlineKeyboardButton("💇 Haircut - $35", callback_data="svc_1")],
            [InlineKeyboardButton("🔙 Back", callback_data="appointments")]
        ]
        return InlineKeyboardMarkup(keyboard)

def get_time_slots_menu():
    slots = list(SLOT_TO_TIME.items())
    keyboard = []
    for i in range(0, len(slots), 2):
        row = [InlineKeyboardButton(slots[i][1], callback_data=slots[i][0])]
        if i + 1 < len(slots):
            row.append(InlineKeyboardButton(slots[i+1][1], callback_data=slots[i+1][0]))
        keyboard.append(row)
    keyboard.append([InlineKeyboardButton("🔙 Back", callback_data="appointments")])
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = (
        "🪞 *Barber Admin Dashboard*\n\n"
        "Welcome! Use the buttons below to manage your shop.\n\n"
        "Quick commands:\n"
        "• Send any text to display on mirror\n"
        "• Send a number (e.g., `45.50`) to record a sale\n"
    )
    await update.message.reply_text(
        welcome_text,
        reply_markup=get_main_menu(),
        parse_mode="Markdown"
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    
    if data == "main_menu":
        await query.edit_message_text(
            "🪞 *Barber Admin Dashboard*\n\nSelect an option:",
            reply_markup=get_main_menu(),
            parse_mode="Markdown"
        )
    
    elif data == "appointments":
        await query.edit_message_text(
            "📅 *Appointments*\n\nManage today's schedule:",
            reply_markup=get_appointments_menu(),
            parse_mode="Markdown"
        )
    
    elif data == "view_today":
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            appointments = await db.get_appointments_by_date(today)
            
            if appointments:
                text = "📅 *Today's Appointments:*\n\n"
                for apt in appointments:
                    time_display = SLOT_TO_TIME.get(apt['time_slot'], apt['time_slot'])
                    text += f"⏰ {time_display} - {apt['client_name']}\n"
                    text += f"   Service: {apt.get('service_name', 'General')}\n"
                    if apt.get('barber'):
                        text += f"   Barber: {apt['barber']}\n"
                    text += "\n"
            else:
                text = "📅 No appointments scheduled for today.\n\nUse *Book Appointment* to add one!"
        except Exception as e:
            text = f"📅 Error loading appointments: {e}"
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="appointments")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "running_late":
        context.user_data["awaiting"] = "running_late"
        keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data="appointments")]]
        await query.edit_message_text(
            "⏰ *Running Late Alert*\n\nEnter client name and appointment time:\n\nExample: `John 6:00 PM`",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
    
    elif data == "financial":
        await query.edit_message_text(
            "📊 *Financial Tracking*\n\nTrack your earnings:",
            reply_markup=get_financial_menu(),
            parse_mode="Markdown"
        )
    
    elif data == "record_sale":
        context.user_data["awaiting"] = "sale_amount"
        keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data="financial")]]
        await query.edit_message_text(
            "💰 *Record Sale*\n\nEnter sale amount (e.g., `45.50`):",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
    
    elif data == "today_earnings":
        try:
            transactions = await db.get_recent_transactions(50)
            today = datetime.now().strftime("%Y-%m-%d")
            today_transactions = [t for t in transactions if str(t.get('occurred_at', ''))[:10] == today]
            today_total = sum(t.get("amount_cents", 0) for t in today_transactions) / 100
            
            text = f"💰 *Today's Earnings*\n\nTotal: *${today_total:.2f}*\n\n"
            
            if today_transactions:
                text += "Recent transactions:\n"
                for t in today_transactions[:5]:
                    amount = t.get('amount_cents', 0) / 100
                    text += f"• ${amount:.2f} - {t.get('service_name', 'Sale')}\n"
        except Exception as e:
            text = f"💰 Error loading earnings: {e}"
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="financial")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "weekly_progress":
        try:
            budget = await db.get_budget_summary()
            weekly_total = budget['current_week_earned'] / 100
            weekly_goal = budget['weekly_goal'] / 100
            
            progress = min(100, (weekly_total / weekly_goal) * 100) if weekly_goal > 0 else 0
            remaining = max(0, weekly_goal - weekly_total)
            progress_bar = "█" * int(progress / 10) + "░" * (10 - int(progress / 10))
            
            text = f"📊 *Weekly Progress*\n\n"
            text += f"Goal: ${weekly_goal:.2f}\n"
            text += f"Earned: ${weekly_total:.2f}\n"
            text += f"Remaining: ${remaining:.2f}\n\n"
            text += f"[{progress_bar}] {progress:.1f}%"
        except Exception as e:
            text = f"📊 Error loading progress: {e}"
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="financial")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "customers":
        try:
            async with (await db.init_pool()).acquire() as conn:
                users = await conn.fetch("SELECT * FROM users ORDER BY recognition_count DESC LIMIT 10")
            
            if users:
                text = "👥 *Customer History*\n\n"
                for user in users:
                    visits = user.get("recognition_count", 0)
                    text += f"• {user.get('name', 'Unknown')} - {visits} visits\n"
            else:
                text = "👥 No customers registered yet."
        except Exception as e:
            text = f"👥 Error loading customers: {e}"
        
        keyboard = [[InlineKeyboardButton("🔙 Main Menu", callback_data="main_menu")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "mirror_controls":
        await query.edit_message_text(
            "📺 *Mirror Controls*\n\nRemotely control the mirror:",
            reply_markup=get_mirror_controls_menu(),
            parse_mode="Markdown"
        )
    
    elif data.startswith("cmd_"):
        command = data.replace("cmd_", "")
        sender = update.effective_user.first_name or "Admin"
        await log_message_to_db(sender, f"[COMMAND] {command}", update.effective_chat.id)
        
        command_names = {
            "detect_face": "Detect Face",
            "show_appointments": "Show Appointments",
            "show_weather": "Show Weather",
            "show_news": "Show News",
            "clear": "Clear Display"
        }
        
        await query.edit_message_text(
            f"✅ Command sent: *{command_names.get(command, command)}*\n\nThe mirror will update shortly.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Back", callback_data="mirror_controls")]]),
            parse_mode="Markdown"
        )
    
    elif data == "send_message":
        context.user_data["awaiting"] = "mirror_message"
        keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data="main_menu")]]
        await query.edit_message_text(
            "💬 *Send Message to Mirror*\n\nType your message below.\n\nExamples:\n• `Running 10 mins late!`\n• `Special: 20% off today!`",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
    
    elif data == "book_appointment":
        service_menu = await get_service_menu()
        await query.edit_message_text(
            "📅 *Book Appointment*\n\nSelect a service:",
            reply_markup=service_menu,
            parse_mode="Markdown"
        )
    
    elif data.startswith("svc_"):
        try:
            service_id = int(data.replace("svc_", ""))
            service = await db.get_service_by_id(service_id)
            
            if service:
                context.user_data["booking_service_id"] = service_id
                context.user_data["booking_service"] = service['name']
                context.user_data["booking_price"] = service['price_cents'] / 100
                
                await query.edit_message_text(
                    f"📅 *Book: {service['name']}* (${service['price_cents']/100:.0f})\n\nSelect a time slot:",
                    reply_markup=get_time_slots_menu(),
                    parse_mode="Markdown"
                )
            else:
                await query.edit_message_text(
                    "❌ Service not found. Please try again.",
                    reply_markup=get_appointments_menu(),
                    parse_mode="Markdown"
                )
        except Exception as e:
            print(f"Error selecting service: {e}")
            await query.edit_message_text(
                "❌ Error loading service. Please try again.",
                reply_markup=get_appointments_menu(),
                parse_mode="Markdown"
            )
    
    elif data.startswith("slot_"):
        time_str = SLOT_TO_TIME.get(data, "TBD")
        context.user_data["booking_time_slot"] = data
        context.user_data["booking_time"] = time_str
        context.user_data["awaiting"] = "booking_name"
        
        service = context.user_data.get("booking_service", "Service")
        keyboard = [[InlineKeyboardButton("❌ Cancel", callback_data="appointments")]]
        await query.edit_message_text(
            f"📅 *Almost Done!*\n\nService: {service}\nTime: {time_str}\n\nPlease enter your name:",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode="Markdown"
        )
    
    elif data == "cancel_appointment":
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            appointments = await db.get_appointments_by_date(today)
            
            if appointments:
                keyboard = []
                for apt in appointments:
                    time_display = SLOT_TO_TIME.get(apt['time_slot'], apt['time_slot'])
                    apt_text = f"{time_display} - {apt['client_name']}"
                    keyboard.append([InlineKeyboardButton(f"❌ {apt_text}", callback_data=f"cancel_apt_{apt['id']}")])
                keyboard.append([InlineKeyboardButton("🔙 Back", callback_data="appointments")])
                
                await query.edit_message_text(
                    "❌ *Cancel Appointment*\n\nSelect appointment to cancel:",
                    reply_markup=InlineKeyboardMarkup(keyboard),
                    parse_mode="Markdown"
                )
            else:
                keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="appointments")]]
                await query.edit_message_text(
                    "📅 No appointments to cancel today.",
                    reply_markup=InlineKeyboardMarkup(keyboard),
                    parse_mode="Markdown"
                )
        except Exception as e:
            keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="appointments")]]
            await query.edit_message_text(
                f"❌ Error loading appointments: {e}",
                reply_markup=InlineKeyboardMarkup(keyboard),
                parse_mode="Markdown"
            )
    
    elif data.startswith("cancel_apt_"):
        try:
            apt_id = int(data.replace("cancel_apt_", ""))
            async with (await db.init_pool()).acquire() as conn:
                apt = await conn.fetchrow("SELECT * FROM appointments WHERE id = $1", apt_id)
                await conn.execute("UPDATE appointments SET status = 'cancelled' WHERE id = $1", apt_id)
            
            if apt:
                time_display = SLOT_TO_TIME.get(apt['time_slot'], apt['time_slot'])
                text = f"✅ Appointment cancelled!\n\n{time_display} - {apt['client_name']}"
            else:
                text = "✅ Appointment cancelled!"
            
            await query.edit_message_text(
                text,
                reply_markup=get_appointments_menu(),
                parse_mode="Markdown"
            )
        except Exception as e:
            await query.edit_message_text(
                f"❌ Error cancelling: {e}",
                reply_markup=get_appointments_menu(),
                parse_mode="Markdown"
            )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    text = update.message.text.strip()
    chat_id = update.effective_chat.id
    sender = user.first_name or user.username or "Unknown"
    
    awaiting = context.user_data.get("awaiting")
    
    if awaiting == "sale_amount":
        try:
            amount = float(text.replace("$", "").replace(",", ""))
            amount_cents = int(amount * 100)
            
            await db.add_transaction(amount_cents, "Sale", "Walk-in")
            
            context.user_data["awaiting"] = None
            await update.message.reply_text(
                f"✅ Sale of *${amount:.2f}* recorded!",
                reply_markup=get_financial_menu(),
                parse_mode="Markdown"
            )
            return
        except ValueError:
            await update.message.reply_text(
                "❌ Invalid amount. Please enter a number (e.g., `45.50`):",
                parse_mode="Markdown"
            )
            return
        except Exception as e:
            await update.message.reply_text(
                f"❌ Error recording sale: {e}",
                parse_mode="Markdown"
            )
            return
    
    elif awaiting == "running_late":
        await log_message_to_db(sender, f"[LATE] {text}", chat_id)
        context.user_data["awaiting"] = None
        
        await update.message.reply_text(
            f"✅ Late notification sent!\n\nMessage: *{text}*\n\nThe mirror will display this alert.",
            reply_markup=get_main_menu(),
            parse_mode="Markdown"
        )
        return
    
    elif awaiting == "mirror_message":
        await log_message_to_db(sender, text, chat_id)
        context.user_data["awaiting"] = None
        
        await update.message.reply_text(
            f"✅ Message sent to mirror!\n\n\"{text}\"",
            reply_markup=get_main_menu(),
            parse_mode="Markdown"
        )
        return
    
    elif awaiting == "booking_name":
        customer_name = text.strip()
        service = context.user_data.get("booking_service", "Service")
        service_id = context.user_data.get("booking_service_id")
        time_slot = context.user_data.get("booking_time_slot")
        time_str = context.user_data.get("booking_time", "TBD")
        price = context.user_data.get("booking_price", 0)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        try:
            conflict = await db.check_appointment_conflict(today, time_slot)
            if conflict:
                keyboard = [[InlineKeyboardButton("🔙 Try Again", callback_data="book_appointment")]]
                await update.message.reply_text(
                    f"⚠️ *Time Slot Taken*\n\nSorry, {time_str} is already booked.\nPlease select a different time.",
                    reply_markup=InlineKeyboardMarkup(keyboard),
                    parse_mode="Markdown"
                )
                context.user_data["awaiting"] = None
                return
            
            await db.create_appointment(
                client_name=customer_name,
                service_id=service_id,
                appt_date=today,
                time_slot=time_slot,
                booked_by=sender
            )
            
            context.user_data["awaiting"] = None
            context.user_data["booking_service"] = None
            context.user_data["booking_service_id"] = None
            context.user_data["booking_time_slot"] = None
            context.user_data["booking_time"] = None
            context.user_data["booking_price"] = None
            
            await update.message.reply_text(
                f"✅ *Appointment Booked!*\n\n"
                f"👤 Name: {customer_name}\n"
                f"✂️ Service: {service}\n"
                f"⏰ Time: {time_str}\n"
                f"💰 Price: ${price:.0f}\n\n"
                f"See you soon!",
                reply_markup=get_main_menu(),
                parse_mode="Markdown"
            )
            return
        except Exception as e:
            await update.message.reply_text(
                f"❌ Error booking appointment: {e}",
                reply_markup=get_main_menu(),
                parse_mode="Markdown"
            )
            context.user_data["awaiting"] = None
            return
    
    try:
        amount = float(text.replace("$", "").replace(",", ""))
        amount_cents = int(amount * 100)
        
        await db.add_transaction(amount_cents, "Sale", "Walk-in")
        
        await update.message.reply_text(
            f"💰 Sale of *${amount:.2f}* recorded!\n\nSend /start for full menu.",
            parse_mode="Markdown"
        )
        return
    except ValueError:
        pass
    except Exception as e:
        print(f"Error recording sale: {e}")
    
    await log_message_to_db(sender, text, chat_id)
    
    await update.message.reply_text(
        f"📺 Message sent to mirror!\n\n\"{text}\"\n\nSend /start for menu options.",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "🪞 *Barber Mirror Bot Help*\n\n"
        "*Commands:*\n"
        "/start - Show main menu\n"
        "/help - Show this help\n"
        "/today - Show today's appointments\n"
        "/earnings - Show today's earnings\n\n"
        "*Quick Actions:*\n"
        "• Send a number to record a sale\n"
        "• Send text to display on mirror\n\n"
        "*Features:*\n"
        "📅 Appointment management\n"
        "💰 Financial tracking\n"
        "👥 Customer history\n"
        "📺 Remote mirror control"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")

async def today_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        appointments = await db.get_appointments_by_date(today)
        
        if appointments:
            text = "📅 *Today's Appointments:*\n\n"
            for apt in appointments:
                time_display = SLOT_TO_TIME.get(apt['time_slot'], apt['time_slot'])
                text += f"⏰ {time_display} - {apt['client_name']}\n"
                text += f"   Service: {apt.get('service_name', 'General')}\n\n"
        else:
            text = "📅 No appointments scheduled for today."
    except Exception as e:
        text = f"📅 Error loading appointments: {e}"
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def earnings_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        transactions = await db.get_recent_transactions(50)
        today = datetime.now().strftime("%Y-%m-%d")
        today_total = sum(
            t.get("amount_cents", 0) for t in transactions 
            if str(t.get('occurred_at', ''))[:10] == today
        ) / 100
        
        text = f"💰 *Today's Earnings: ${today_total:.2f}*"
    except Exception as e:
        text = f"💰 Error loading earnings: {e}"
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def clear_telegram_connection(token):
    """Clear any existing Telegram connections before starting."""
    import aiohttp
    
    print("Clearing existing Telegram connections...")
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://api.telegram.org/bot{token}/deleteWebhook?drop_pending_updates=true"
            async with session.get(url) as resp:
                result = await resp.json()
                if result.get('ok'):
                    print("Cleared pending updates and webhook")
                else:
                    print(f"Webhook clear result: {result}")
                    
            url2 = f"https://api.telegram.org/bot{token}/getUpdates?offset=-1&timeout=0"
            async with session.get(url2) as resp:
                result2 = await resp.json()
                print(f"Flushed update queue: {result2.get('ok', False)}")
                
        print("Waiting for Telegram to release old connections...")
        await asyncio.sleep(5)
    except Exception as e:
        print(f"Warning: Could not clear webhook: {e}")

def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token:
        print("ERROR: TELEGRAM_BOT_TOKEN not set!")
        return
    
    print("Starting Barber Mirror Assistant Bot...")
    print(f"Bot token configured: {token[:10]}...")
    
    asyncio.run(clear_telegram_connection(token))
    
    application = Application.builder().token(token).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("today", today_command))
    application.add_handler(CommandHandler("earnings", earnings_command))
    application.add_handler(CallbackQueryHandler(handle_callback))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    print("Bot is running! Send /start to @BarberMirrorBot to begin.")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)

if __name__ == "__main__":
    main()
