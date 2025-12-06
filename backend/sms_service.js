const twilio = require('twilio');

let connectionSettings = null;
let twilioClient = null;

async function getCredentials() {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    const xReplitToken = process.env.REPL_IDENTITY 
        ? 'repl ' + process.env.REPL_IDENTITY 
        : process.env.WEB_REPL_RENEWAL 
        ? 'depl ' + process.env.WEB_REPL_RENEWAL 
        : null;

    if (!xReplitToken) {
        throw new Error('X_REPLIT_TOKEN not found for repl/depl');
    }

    connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
        {
            headers: {
                'Accept': 'application/json',
                'X_REPLIT_TOKEN': xReplitToken
            }
        }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
        throw new Error('Twilio not connected');
    }
    
    return {
        accountSid: connectionSettings.settings.account_sid,
        apiKey: connectionSettings.settings.api_key,
        apiKeySecret: connectionSettings.settings.api_key_secret,
        phoneNumber: connectionSettings.settings.phone_number
    };
}

async function getTwilioClient() {
    if (twilioClient) return twilioClient;
    
    const { accountSid, apiKey, apiKeySecret } = await getCredentials();
    twilioClient = twilio(apiKey, apiKeySecret, { accountSid });
    return twilioClient;
}

async function getTwilioFromPhoneNumber() {
    const { phoneNumber } = await getCredentials();
    return phoneNumber;
}

async function sendSMS(toNumber, message) {
    try {
        const client = await getTwilioClient();
        const fromNumber = await getTwilioFromPhoneNumber();
        
        const result = await client.messages.create({
            body: message,
            from: fromNumber,
            to: toNumber
        });
        
        console.log(`SMS sent to ${toNumber}: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('SMS send error:', error.message);
        return { success: false, error: error.message };
    }
}

async function sendAppointmentReminder(appointment, customer) {
    const { service_name, barber_name, appointment_time } = appointment;
    const timeStr = new Date(appointment_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    
    const message = `Reminder: Your ${service_name} appointment with ${barber_name} is scheduled for ${timeStr}. Reply CONFIRM or CANCEL.`;
    
    return sendSMS(customer.phone_number, message);
}

async function sendAppointmentConfirmation(appointment, customer) {
    const { service_name, barber_name, appointment_time } = appointment;
    const timeStr = new Date(appointment_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    
    const message = `Your ${service_name} appointment with ${barber_name} is confirmed for ${timeStr}. See you then!`;
    
    return sendSMS(customer.phone_number, message);
}

async function sendWalkInNotification(queueEntry) {
    const { customer_name, phone_number, position, estimated_wait } = queueEntry;
    
    const message = `Hi ${customer_name}! You're #${position} in line. Estimated wait: ${estimated_wait} mins. We'll text when you're next!`;
    
    return sendSMS(phone_number, message);
}

async function sendWalkInReady(queueEntry) {
    const { customer_name, phone_number, barber_name } = queueEntry;
    
    const message = `${customer_name}, you're up next! ${barber_name} is ready for you. Please head to the chair.`;
    
    return sendSMS(phone_number, message);
}

async function isTwilioConfigured() {
    try {
        await getCredentials();
        return true;
    } catch {
        return false;
    }
}

async function getMessageStatus(messageSid) {
    try {
        const client = await getTwilioClient();
        const message = await client.messages(messageSid).fetch();
        return {
            success: true,
            sid: message.sid,
            status: message.status,
            errorCode: message.errorCode,
            errorMessage: message.errorMessage,
            to: message.to,
            from: message.from,
            dateSent: message.dateSent,
            dateCreated: message.dateCreated
        };
    } catch (error) {
        console.error('Get message status error:', error.message);
        return { success: false, error: error.message };
    }
}

async function getRecentMessages(limit = 10) {
    try {
        const client = await getTwilioClient();
        const messages = await client.messages.list({ limit });
        return {
            success: true,
            messages: messages.map(m => ({
                sid: m.sid,
                status: m.status,
                to: m.to,
                from: m.from,
                body: m.body?.substring(0, 50) + '...',
                errorCode: m.errorCode,
                errorMessage: m.errorMessage,
                dateSent: m.dateSent
            }))
        };
    } catch (error) {
        console.error('Get recent messages error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendSMS,
    sendAppointmentReminder,
    sendAppointmentConfirmation,
    sendWalkInNotification,
    sendWalkInReady,
    getTwilioClient,
    getTwilioFromPhoneNumber,
    isTwilioConfigured,
    getMessageStatus,
    getRecentMessages
};
