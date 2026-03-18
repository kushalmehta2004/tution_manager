type SendInviteMessageInput = {
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
  const target = normalizePhoneForWhatsApp(input.toPhone);
  const encodedBody = encodeURIComponent(input.body);
  const deepLink = `https://wa.me/${target}?text=${encodedBody}`;

  return {
    provider: 'whatsapp-deeplink',
    status: 'ready',
    target,
    deepLink,
  };
}
