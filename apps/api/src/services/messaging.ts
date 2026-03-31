import { env } from '../config/env.js';

type SendInviteMessageInput = {
  toPhone: string;
  body: string;
};

type SendWhatsAppMessageInput = {
  toPhone: string;
  body: string;
};

function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (!digits) {
    throw new Error('Invalid phone number for WhatsApp invite');
  }

  return digits;
}

export async function sendParentInviteMessage(input: SendInviteMessageInput) {
  return sendWhatsAppMessage(input);
}

export async function sendWhatsAppMessage(input: SendWhatsAppMessageInput) {
  const target = normalizePhoneForWhatsApp(input.toPhone);

  if (env.WATI_API_BASE_URL && env.WATI_API_TOKEN) {
    const response = await fetch(`${env.WATI_API_BASE_URL.replace(/\/$/, '')}/api/v1/sendSessionMessage/${target}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WATI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messageText: input.body }),
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `WhatsApp provider send failed: ${response.status} ${
          typeof responseBody === 'object' && responseBody && 'message' in responseBody
            ? String((responseBody as { message?: string }).message)
            : 'Unknown provider error'
        }`,
      );
    }

    return {
      provider: 'wati',
      status: 'sent',
      target,
      providerMessageId:
        typeof responseBody === 'object' && responseBody && 'id' in responseBody
          ? String((responseBody as { id?: string }).id)
          : undefined,
      raw: responseBody,
    };
  }

  const encodedBody = encodeURIComponent(input.body);
  const deepLink = `https://wa.me/${target}?text=${encodedBody}`;

  return {
    provider: 'whatsapp-deeplink',
    status: 'ready',
    target,
    deepLink,
  };
}
