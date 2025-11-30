#!/usr/bin/env python3
"""
Telegram Bot for SmartMirror - Barber Mirror Assistant
Provides interactive menus, message relay, and remote admin controls.
"""

import os
import json
import asyncio
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes
)

TELEGRAM_LOG_FILE = os.path.join(os.path.dirname(__file__), "telegram_log.json")
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

def load_data():
    """Load persistent data from JSON file."""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading data: {e}")
    return {
        "users": [],
        "appointments": [],
        "budget": {"weekly_goal": 2000, "monthly_goal": 8000, "transactions": []},
        "telegram_messages": []
    }

def save_data(data):
    """Save data to persistent JSON file."""
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving data: {e}")

def log_telegram_message(sender, text, chat_id):
    """Log incoming Telegram message to persistent file."""
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
            
        data = load_data()
        data["telegram_messages"] = data.get("telegram_messages", [])
        data["telegram_messages"].insert(0, log_entry)
        data["telegram_messages"] = data["telegram_messages"][:50]
        save_data(data)
        
    except Exception as e:
        print(f"Error logging message: {e}")
    
    return log_entry

def get_main_menu():
    """Return the main menu keyboard."""
    keyboard = [
        [InlineKeyboardButton("📅 Today's Appointments", callback_data="appointments")],
        [InlineKeyboardButton("📊 Financial Tracking", callback_data="financial")],
        [InlineKeyboardButton("👥 Customer History", callback_data="customers")],
        [InlineKeyboardButton("📺 Mirror Controls", callback_data="mirror_controls")],
        [InlineKeyboardButton("💬 Send Message to Mirror", callback_data="send_message")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_financial_menu():
    """Return the financial tracking submenu."""
    keyboard = [
        [InlineKeyboardButton("💰 Record Sale", callback_data="record_sale")],
        [InlineKeyboardButton("📈 Today's Earnings", callback_data="today_earnings")],
        [InlineKeyboardButton("📊 Weekly Progress", callback_data="weekly_progress")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_mirror_controls_menu():
    """Return the mirror controls submenu."""
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
    """Return the appointments submenu."""
    keyboard = [
        [InlineKeyboardButton("📋 View Today", callback_data="view_today")],
        [InlineKeyboardButton("➕ Add Appointment", callback_data="add_appointment")],
        [InlineKeyboardButton("⏰ Running Late Alert", callback_data="running_late")],
        [InlineKeyboardButton("🏠 Main Menu", callback_data="main_menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command - show main menu."""
    user = update.effective_user
    log_telegram_message(user.first_name or user.username or "Unknown", "/start", update.effective_chat.id)
    
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
    """Handle inline button callbacks."""
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
        app_data = load_data()
        appointments = app_data.get("appointments", [])
        today = datetime.now().strftime("%Y-%m-%d")
        today_appointments = [a for a in appointments if a.get("date", "").startswith(today)]
        
        if today_appointments:
            text = "📅 *Today's Appointments:*\n\n"
            for apt in today_appointments:
                text += f"⏰ {apt.get('time', 'N/A')} - {apt.get('client', 'Unknown')}\n"
                text += f"   Service: {apt.get('service', 'General')}\n"
                text += f"   Barber: {apt.get('barber', 'Any')}\n\n"
        else:
            text = "📅 No appointments scheduled for today."
        
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
        app_data = load_data()
        budget = app_data.get("budget", {})
        transactions = budget.get("transactions", [])
        today = datetime.now().strftime("%Y-%m-%d")
        today_total = sum(t.get("amount", 0) for t in transactions if t.get("date", "").startswith(today))
        
        text = f"💰 *Today's Earnings*\n\n"
        text += f"Total: *${today_total:.2f}*\n\n"
        
        today_transactions = [t for t in transactions if t.get("date", "").startswith(today)]
        if today_transactions:
            text += "Recent transactions:\n"
            for t in today_transactions[-5:]:
                text += f"• ${t.get('amount', 0):.2f} - {t.get('service', 'Sale')}\n"
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="financial")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "weekly_progress":
        app_data = load_data()
        budget = app_data.get("budget", {})
        transactions = budget.get("transactions", [])
        weekly_goal = budget.get("weekly_goal", 2000)
        
        from datetime import timedelta
        week_start = datetime.now() - timedelta(days=datetime.now().weekday())
        week_start_str = week_start.strftime("%Y-%m-%d")
        
        weekly_total = sum(
            t.get("amount", 0) for t in transactions 
            if t.get("date", "") >= week_start_str
        )
        
        progress = min(100, (weekly_total / weekly_goal) * 100) if weekly_goal > 0 else 0
        remaining = max(0, weekly_goal - weekly_total)
        
        progress_bar = "█" * int(progress / 10) + "░" * (10 - int(progress / 10))
        
        text = f"📊 *Weekly Progress*\n\n"
        text += f"Goal: ${weekly_goal:.2f}\n"
        text += f"Earned: ${weekly_total:.2f}\n"
        text += f"Remaining: ${remaining:.2f}\n\n"
        text += f"[{progress_bar}] {progress:.1f}%"
        
        keyboard = [[InlineKeyboardButton("🔙 Back", callback_data="financial")]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
    
    elif data == "customers":
        app_data = load_data()
        users = app_data.get("users", [])
        
        if users:
            text = "👥 *Customer History*\n\n"
            for user in users[:10]:
                visits = user.get("recognized_count", 0)
                last_service = "Unknown"
                if user.get("service_history"):
                    last_service = user["service_history"][-1].get("service", "Unknown")
                text += f"• {user.get('name', 'Unknown')} - {visits} visits\n"
                text += f"  Last: {last_service}\n"
        else:
            text = "👥 No customers registered yet."
        
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
        log_telegram_message("Admin", f"[COMMAND] {command}", update.effective_chat.id)
        
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

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages."""
    user = update.effective_user
    text = update.message.text.strip()
    chat_id = update.effective_chat.id
    sender = user.first_name or user.username or "Unknown"
    
    awaiting = context.user_data.get("awaiting")
    
    if awaiting == "sale_amount":
        try:
            amount = float(text.replace("$", "").replace(",", ""))
            app_data = load_data()
            
            transaction = {
                "id": int(datetime.now().timestamp() * 1000),
                "amount": amount,
                "service": "Sale",
                "date": datetime.now().isoformat(),
                "client": "Walk-in"
            }
            
            app_data["budget"]["transactions"] = app_data["budget"].get("transactions", [])
            app_data["budget"]["transactions"].append(transaction)
            save_data(app_data)
            
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
    
    elif awaiting == "running_late":
        log_telegram_message(sender, f"[LATE] {text}", chat_id)
        context.user_data["awaiting"] = None
        
        await update.message.reply_text(
            f"✅ Late notification sent!\n\nMessage: *{text}*\n\nThe mirror will display this alert.",
            reply_markup=get_main_menu(),
            parse_mode="Markdown"
        )
        return
    
    elif awaiting == "mirror_message":
        log_telegram_message(sender, text, chat_id)
        context.user_data["awaiting"] = None
        
        await update.message.reply_text(
            f"✅ Message sent to mirror!\n\n\"{text}\"",
            reply_markup=get_main_menu(),
            parse_mode="Markdown"
        )
        return
    
    try:
        amount = float(text.replace("$", "").replace(",", ""))
        app_data = load_data()
        
        transaction = {
            "id": int(datetime.now().timestamp() * 1000),
            "amount": amount,
            "service": "Sale",
            "date": datetime.now().isoformat(),
            "client": "Walk-in"
        }
        
        app_data["budget"]["transactions"] = app_data["budget"].get("transactions", [])
        app_data["budget"]["transactions"].append(transaction)
        save_data(app_data)
        
        await update.message.reply_text(
            f"💰 Sale of *${amount:.2f}* recorded!\n\nSend /start for full menu.",
            parse_mode="Markdown"
        )
        return
    except ValueError:
        pass
    
    log_telegram_message(sender, text, chat_id)
    
    await update.message.reply_text(
        f"📺 Message sent to mirror!\n\n\"{text}\"\n\nSend /start for menu options.",
        parse_mode="Markdown"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
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
    """Handle /today command - show today's appointments."""
    app_data = load_data()
    appointments = app_data.get("appointments", [])
    today = datetime.now().strftime("%Y-%m-%d")
    today_appointments = [a for a in appointments if a.get("date", "").startswith(today)]
    
    if today_appointments:
        text = "📅 *Today's Appointments:*\n\n"
        for apt in today_appointments:
            text += f"⏰ {apt.get('time', 'N/A')} - {apt.get('client', 'Unknown')}\n"
            text += f"   Service: {apt.get('service', 'General')}\n\n"
    else:
        text = "📅 No appointments scheduled for today."
    
    await update.message.reply_text(text, parse_mode="Markdown")

async def earnings_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /earnings command - show today's earnings."""
    app_data = load_data()
    budget = app_data.get("budget", {})
    transactions = budget.get("transactions", [])
    today = datetime.now().strftime("%Y-%m-%d")
    today_total = sum(t.get("amount", 0) for t in transactions if t.get("date", "").startswith(today))
    
    text = f"💰 *Today's Earnings: ${today_total:.2f}*"
    await update.message.reply_text(text, parse_mode="Markdown")

def main():
    """Start the bot."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    
    if not token:
        print("ERROR: TELEGRAM_BOT_TOKEN not set in environment variables!")
        print("Please add your bot token to Replit Secrets.")
        return
    
    print("Starting Barber Mirror Assistant Bot...")
    print(f"Bot token configured: {token[:10]}...")
    
    application = Application.builder().token(token).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("today", today_command))
    application.add_handler(CommandHandler("earnings", earnings_command))
    
    application.add_handler(CallbackQueryHandler(handle_callback))
    
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    print("Bot is running! Send /start to @BarberMirrorBot to begin.")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
