interface CompactPayload {
  action?: string;
  account_id?: string;
  profile_id?: string;
  platform?: string;
  user_id?: string;
  created_at?: string;
  metadata?: {
    messageId?: string;
    conversationId?: string;
    senderName?: string;
    messagePreview?: string;
    source?: string;
    hasAttachment?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function normalizeZernioPayload(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.action && raw.metadata) {
    return normalizeCompactPayload(raw as CompactPayload);
  }
  return raw;
}

function normalizeCompactPayload(raw: CompactPayload): Record<string, unknown> {
  const meta = raw.metadata ?? {};
  const platform = (raw.platform as string) ?? '';
  const userId = (raw.user_id as string) ?? '';
  const accountId = (raw.account_id as string) ?? '';
  const profileId = (raw.profile_id as string) ?? '';
  const createdAt = (raw.created_at as string) ?? '';
  const messageId = (meta.messageId as string) ?? '';
  const conversationId = (meta.conversationId as string) ?? '';
  const senderName = (meta.senderName as string) ?? '';
  const messageText = (meta.messagePreview as string) ?? '';
  const direction: 'incoming' | 'outgoing' =
    meta.source === 'contact' ? 'incoming' : 'outgoing';

  return {
    id: messageId || createdAt,
    event: raw.action,
    timestamp: createdAt,
    account: {
      id: accountId,
      accountId,
      profileId,
      platform,
      username: senderName,
      displayName: senderName,
    },
    message: {
      id: messageId,
      conversationId,
      platform,
      platformMessageId: messageId,
      direction,
      text: messageText,
      attachments: [],
      sender: {
        id: userId,
        name: senderName,
        phoneNumber: userId,
        contactId: userId,
      },
      sentAt: createdAt,
      isRead: false,
    },
    conversation: {
      id: conversationId,
      platformConversationId: conversationId,
      participantId: userId,
      participantName: senderName,
      participantUsername: senderName,
      status: 'active',
      contactId: userId,
    },
  };
}
