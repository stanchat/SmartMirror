import os
import asyncpg
import asyncio
from datetime import datetime, date
from typing import Optional, List, Dict, Any

pool: Optional[asyncpg.Pool] = None

async def init_pool():
    global pool
    if pool is None:
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
        print("Database pool initialized")
    return pool

async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None

async def get_services(active_only: bool = True) -> List[Dict]:
    await init_pool()
    query = "SELECT * FROM services WHERE is_active = true ORDER BY name" if active_only else "SELECT * FROM services ORDER BY name"
    async with pool.acquire() as conn:
        rows = await conn.fetch(query)
        return [dict(row) for row in rows]

async def get_service_by_id(service_id: int) -> Optional[Dict]:
    await init_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM services WHERE id = $1", service_id)
        return dict(row) if row else None

async def get_appointments_by_date(appt_date: str) -> List[Dict]:
    await init_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT a.*, s.name as service_name, s.price_cents 
            FROM appointments a 
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.appointment_date = $1 AND a.status = 'scheduled'
            ORDER BY a.start_time
        """, appt_date)
        return [dict(row) for row in rows]

async def check_appointment_conflict(appt_date: str, time_slot: str) -> bool:
    await init_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id FROM appointments 
            WHERE appointment_date = $1 AND time_slot = $2 AND status = 'scheduled'
        """, appt_date, time_slot)
        return row is not None

async def create_appointment(
    client_name: str,
    service_id: int,
    appt_date: str,
    time_slot: str,
    booked_by: str,
    user_id: Optional[int] = None,
    barber: str = "Any"
) -> Dict:
    await init_pool()
    
    time_slot_to_time = {
        'slot_0900': '09:00', 'slot_1000': '10:00', 'slot_1100': '11:00',
        'slot_1200': '12:00', 'slot_1300': '13:00', 'slot_1400': '14:00',
        'slot_1500': '15:00', 'slot_1600': '16:00', 'slot_1700': '17:00'
    }
    start_time = time_slot_to_time.get(time_slot, '12:00')
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO appointments 
            (user_id, service_id, client_name, appointment_date, time_slot, start_time, barber, booked_via, booked_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'telegram', $8) 
            RETURNING *
        """, user_id, service_id, client_name, appt_date, time_slot, start_time, barber, booked_by)
        return dict(row)

async def log_message(
    chat_id: int,
    sender: str,
    text: str,
    user_id: Optional[int] = None
) -> Dict:
    await init_pool()
    is_command = text.startswith('/')
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO messages (user_id, chat_id, sender, text, is_command, is_new)
            VALUES ($1, $2, $3, $4, $5, true) RETURNING *
        """, user_id, chat_id, sender, text, is_command)
        return dict(row)

async def get_new_messages() -> List[Dict]:
    await init_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM messages WHERE is_new = true AND is_command = false 
            ORDER BY sent_at DESC
        """)
        return [dict(row) for row in rows]

async def get_user_by_chat_id(chat_id: int) -> Optional[Dict]:
    await init_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM users WHERE telegram_chat_id = $1", chat_id)
        return dict(row) if row else None

async def create_user(name: str, telegram_chat_id: Optional[int] = None) -> Dict:
    await init_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO users (name, telegram_chat_id, created_at)
            VALUES ($1, $2, NOW()) RETURNING *
        """, name, telegram_chat_id)
        return dict(row)

async def add_transaction(
    amount_cents: int,
    service_name: str,
    client_name: str,
    appointment_id: Optional[int] = None,
    user_id: Optional[int] = None
) -> Dict:
    await init_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO transactions (appointment_id, user_id, amount_cents, service_name, client_name)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        """, appointment_id, user_id, amount_cents, service_name, client_name)
        return dict(row)

async def get_budget_summary() -> Dict:
    await init_pool()
    async with pool.acquire() as conn:
        weekly = await conn.fetchrow("""
            SELECT COALESCE(SUM(amount_cents), 0) as total 
            FROM transactions 
            WHERE occurred_at >= DATE_TRUNC('week', CURRENT_DATE)
        """)
        monthly = await conn.fetchrow("""
            SELECT COALESCE(SUM(amount_cents), 0) as total 
            FROM transactions 
            WHERE occurred_at >= DATE_TRUNC('month', CURRENT_DATE)
        """)
        targets = await conn.fetch("SELECT * FROM budget_targets")
        
        weekly_target = next((t for t in targets if t['period'] == 'weekly'), None)
        monthly_target = next((t for t in targets if t['period'] == 'monthly'), None)
        
        return {
            'weekly_goal': weekly_target['goal_cents'] if weekly_target else 200000,
            'monthly_goal': monthly_target['goal_cents'] if monthly_target else 800000,
            'current_week_earned': int(weekly['total']),
            'current_month_earned': int(monthly['total'])
        }

async def get_recent_transactions(limit: int = 20) -> List[Dict]:
    await init_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM transactions ORDER BY occurred_at DESC LIMIT $1",
            limit
        )
        return [dict(row) for row in rows]
