from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import random
import time
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {
        'users': [
            {'id': 1, 'name': 'Stan', 'trained_at': '2025-01-15', 'recognition_count': 42},
            {'id': 2, 'name': 'Sarah', 'trained_at': '2025-02-20', 'recognition_count': 28},
            {'id': 3, 'name': 'Mike', 'trained_at': '2025-03-10', 'recognition_count': 15}
        ],
        'appointments': [
            {'id': 1, 'user': 'Stan', 'service': 'Haircut', 'time': '10:00 AM', 'date': 'today', 'barber': 'Joe'},
            {'id': 2, 'user': 'Sarah', 'service': 'Color', 'time': '2:00 PM', 'date': 'today', 'barber': 'Mike'},
            {'id': 3, 'user': 'Mike', 'service': 'Trim', 'time': '4:30 PM', 'date': 'tomorrow', 'barber': 'Joe'}
        ],
        'budget': {
            'weekly_goal': 2000,
            'monthly_goal': 8000,
            'current_week_earned': 850,
            'current_month_earned': 3200,
            'transactions': [
                {'date': '2025-11-28', 'amount': 45, 'service': 'Haircut', 'client': 'John'},
                {'date': '2025-11-28', 'amount': 120, 'service': 'Color & Cut', 'client': 'Mary'},
                {'date': '2025-11-29', 'amount': 35, 'service': 'Trim', 'client': 'Stan'}
            ]
        },
        'recognition_log': []
    }

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'SmartMirror Backend'})

@app.route('/api/detect_face', methods=['POST'])
def detect_face():
    data = load_data()
    users = data['users']
    
    simulate_delay = random.uniform(0.5, 1.5)
    time.sleep(simulate_delay)
    
    detection_chance = random.random()
    
    if detection_chance > 0.3 and users:
        recognized_user = random.choice(users)
        recognized_user['recognition_count'] += 1
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'user': recognized_user['name'],
            'confidence': round(random.uniform(0.85, 0.99), 2)
        }
        data['recognition_log'].append(log_entry)
        save_data(data)
        
        return jsonify({
            'success': True,
            'recognized': True,
            'user': {
                'name': recognized_user['name'],
                'id': recognized_user['id']
            },
            'confidence': log_entry['confidence'],
            'message': f"Welcome back, {recognized_user['name']}!"
        })
    elif detection_chance > 0.1:
        return jsonify({
            'success': True,
            'recognized': False,
            'message': 'Face detected but not recognized. Would you like to train a new face?'
        })
    else:
        return jsonify({
            'success': True,
            'recognized': False,
            'no_face': True,
            'message': 'No face detected. Please look at the mirror.'
        })

@app.route('/api/train_face', methods=['POST'])
def train_face():
    req_data = request.get_json() or {}
    name = req_data.get('name', f'User_{random.randint(100, 999)}')
    
    time.sleep(random.uniform(1.0, 2.0))
    
    data = load_data()
    
    existing = next((u for u in data['users'] if u['name'].lower() == name.lower()), None)
    if existing:
        return jsonify({
            'success': False,
            'message': f'User {name} already exists in the system.'
        })
    
    new_user = {
        'id': max([u['id'] for u in data['users']], default=0) + 1,
        'name': name,
        'trained_at': datetime.now().strftime('%Y-%m-%d'),
        'recognition_count': 0
    }
    data['users'].append(new_user)
    save_data(data)
    
    return jsonify({
        'success': True,
        'message': f'Successfully trained new face for {name}!',
        'user': new_user
    })

@app.route('/api/users', methods=['GET'])
def get_users():
    data = load_data()
    return jsonify({
        'success': True,
        'users': data['users'],
        'count': len(data['users'])
    })

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    data = load_data()
    data['users'] = [u for u in data['users'] if u['id'] != user_id]
    save_data(data)
    return jsonify({'success': True, 'message': 'User deleted'})

@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    data = load_data()
    filter_date = request.args.get('date', 'all')
    
    appointments = data['appointments']
    if filter_date == 'today':
        appointments = [a for a in appointments if a['date'] == 'today']
    elif filter_date == 'tomorrow':
        appointments = [a for a in appointments if a['date'] == 'tomorrow']
    
    return jsonify({
        'success': True,
        'appointments': appointments,
        'count': len(appointments)
    })

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    req_data = request.get_json() or {}
    data = load_data()
    
    new_appointment = {
        'id': max([a['id'] for a in data['appointments']], default=0) + 1,
        'user': req_data.get('user', 'Guest'),
        'service': req_data.get('service', 'Haircut'),
        'time': req_data.get('time', '12:00 PM'),
        'date': req_data.get('date', 'today'),
        'barber': req_data.get('barber', 'Available')
    }
    data['appointments'].append(new_appointment)
    save_data(data)
    
    return jsonify({
        'success': True,
        'message': 'Appointment booked successfully!',
        'appointment': new_appointment
    })

@app.route('/api/appointments/<int:appointment_id>', methods=['DELETE'])
def cancel_appointment(appointment_id):
    data = load_data()
    data['appointments'] = [a for a in data['appointments'] if a['id'] != appointment_id]
    save_data(data)
    return jsonify({'success': True, 'message': 'Appointment cancelled'})

@app.route('/api/budget', methods=['GET'])
def get_budget():
    data = load_data()
    budget = data['budget']
    
    weekly_progress = (budget['current_week_earned'] / budget['weekly_goal']) * 100
    monthly_progress = (budget['current_month_earned'] / budget['monthly_goal']) * 100
    
    return jsonify({
        'success': True,
        'budget': {
            'weekly_goal': budget['weekly_goal'],
            'monthly_goal': budget['monthly_goal'],
            'current_week_earned': budget['current_week_earned'],
            'current_month_earned': budget['current_month_earned'],
            'weekly_remaining': budget['weekly_goal'] - budget['current_week_earned'],
            'monthly_remaining': budget['monthly_goal'] - budget['current_month_earned'],
            'weekly_progress': round(weekly_progress, 1),
            'monthly_progress': round(monthly_progress, 1)
        },
        'recent_transactions': budget['transactions'][-5:]
    })

@app.route('/api/budget/transaction', methods=['POST'])
def add_transaction():
    req_data = request.get_json() or {}
    data = load_data()
    
    amount = req_data.get('amount', 0)
    transaction = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'amount': amount,
        'service': req_data.get('service', 'Service'),
        'client': req_data.get('client', 'Client')
    }
    
    data['budget']['transactions'].append(transaction)
    data['budget']['current_week_earned'] += amount
    data['budget']['current_month_earned'] += amount
    save_data(data)
    
    return jsonify({
        'success': True,
        'message': f'Added ${amount} to earnings',
        'transaction': transaction
    })

@app.route('/api/budget/goals', methods=['PUT'])
def update_goals():
    req_data = request.get_json() or {}
    data = load_data()
    
    if 'weekly_goal' in req_data:
        data['budget']['weekly_goal'] = req_data['weekly_goal']
    if 'monthly_goal' in req_data:
        data['budget']['monthly_goal'] = req_data['monthly_goal']
    
    save_data(data)
    return jsonify({'success': True, 'message': 'Goals updated'})

@app.route('/api/voice_command', methods=['POST'])
def process_voice_command():
    req_data = request.get_json() or {}
    command = req_data.get('command', '').lower().strip()
    
    if not command.startswith('mirror mirror'):
        return jsonify({
            'success': False,
            'message': 'Please start with "Mirror mirror..." to activate voice commands.'
        })
    
    command_text = command.replace('mirror mirror', '').strip()
    
    if 'detect face' in command_text or 'who am i' in command_text:
        return jsonify({
            'success': True,
            'action': 'detect_face',
            'message': 'Starting face detection...',
            'speak': 'Scanning for face recognition'
        })
    elif 'new face' in command_text or 'train' in command_text:
        return jsonify({
            'success': True,
            'action': 'train_face',
            'message': 'Starting face training mode...',
            'speak': 'Please look at the mirror for face training'
        })
    elif 'appointment' in command_text or 'schedule' in command_text:
        return jsonify({
            'success': True,
            'action': 'show_appointments',
            'message': 'Showing appointments...',
            'speak': 'Here are your appointments for today'
        })
    elif 'budget' in command_text or 'earnings' in command_text:
        return jsonify({
            'success': True,
            'action': 'show_budget',
            'message': 'Showing budget tracker...',
            'speak': 'Displaying your budget summary'
        })
    elif 'weather' in command_text:
        return jsonify({
            'success': True,
            'action': 'show_weather',
            'message': 'Weather information displayed',
            'speak': 'Showing weather forecast'
        })
    elif 'time' in command_text:
        current_time = datetime.now().strftime('%I:%M %p')
        return jsonify({
            'success': True,
            'action': 'tell_time',
            'message': f'The time is {current_time}',
            'speak': f'The current time is {current_time}'
        })
    elif 'hello' in command_text or 'hi' in command_text:
        return jsonify({
            'success': True,
            'action': 'greeting',
            'message': 'Hello! How can I help you today?',
            'speak': 'Hello! How can I help you today?'
        })
    else:
        return jsonify({
            'success': True,
            'action': 'unknown',
            'message': f'Command not recognized: "{command_text}"',
            'speak': 'Sorry, I did not understand that command. Try saying detect face, show appointments, or show budget.',
            'available_commands': [
                'detect face',
                'new face / train',
                'show appointments',
                'show budget',
                'what time is it',
                'show weather'
            ]
        })

@app.route('/api/recognition_log', methods=['GET'])
def get_recognition_log():
    data = load_data()
    return jsonify({
        'success': True,
        'log': data.get('recognition_log', [])[-20:]
    })

if __name__ == '__main__':
    if not os.path.exists(DATA_FILE):
        save_data(load_data())
    app.run(host='localhost', port=3001, debug=False)
