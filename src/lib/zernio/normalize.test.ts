import { describe, expect, it } from "vitest";
import { normalizeZernioPayload } from "./normalize";

describe("normalizeZernioPayload", () => {
  it("passes through official-format payload unchanged", () => {
    const officialPayload = {
      id: "evt-001",
      event: "message.received",
      timestamp: "2026-08-03T15:14:57Z",
      account: {
        id: "acc-001",
        accountId: "acc-001",
        profileId: "prof-001",
        platform: "instagram",
        username: "douglas_cuimar",
        displayName: "Douglas",
      },
      message: {
        id: "msg-001",
        conversationId: "conv-001",
        platform: "instagram",
        platformMessageId: "pl-001",
        direction: "incoming" as const,
        text: "Ola",
        attachments: [],
        sender: {
          id: "usr-001",
          name: "douglas_cuimar",
          phoneNumber: "",
          contactId: "usr-001",
        },
        sentAt: "2026-08-03T15:14:57Z",
        isRead: false,
      },
      conversation: {
        id: "conv-001",
        platformConversationId: "conv-001",
        participantId: "usr-001",
        participantName: "douglas_cuimar",
        participantUsername: "douglas_cuimar",
        status: "active",
        contactId: "usr-001",
      },
    };

    const result = normalizeZernioPayload(structuredClone(officialPayload));
    expect(result).toEqual(officialPayload);
  });

  it("normalizes compact payload from Zernio webhook log (action + metadata)", () => {
    const compactPayload = {
      type: "messaging",
      user_id: "6a527b82f46514452d3c41be",
      profile_id: "6a614a2411a92e1bd111111",
      platform: "instagram",
      account_id: "6a6dd8401111111111111111",
      status: "success",
      created_at: "2026-08-03 15:14:57",
      metadata: {
        messageId: "msg-instagram-abc123",
        conversationId: "6a6dd8addf11111111111111",
        senderName: "douglas_cuimar",
        messageLength: 3,
        hasAttachment: false,
        messagePreview: "Ola",
        source: "contact",
      },
      action: "message.received",
      total_count: 271,
    };

    const result = normalizeZernioPayload(structuredClone(compactPayload));

    expect(result.event).toBe("message.received");
    expect(result.timestamp).toBe("2026-08-03 15:14:57");

    const acct = result.account as Record<string, unknown>;
    expect(acct).toBeDefined();
    expect(acct.accountId).toBe("6a6dd8401111111111111111");
    expect(acct.profileId).toBe("6a614a2411a92e1bd111111");
    expect(acct.platform).toBe("instagram");

    const msg = result.message as Record<string, unknown>;
    expect(msg).toBeDefined();
    expect(msg.id).toBe("msg-instagram-abc123");
    expect(msg.direction).toBe("incoming");
    expect(msg.text).toBe("Ola");
    expect(msg.platform).toBe("instagram");

    const sender = msg.sender as Record<string, unknown>;
    expect(sender.name).toBe("douglas_cuimar");

    const conv = result.conversation as Record<string, unknown>;
    expect(conv).toBeDefined();
    expect(conv.id).toBe("6a6dd8addf11111111111111");
    expect(conv.participantName).toBe("douglas_cuimar");
  });

  it("treats source: 'me' as outgoing direction", () => {
    const compactPayload = {
      action: "message.sent",
      user_id: "usr-me-001",
      profile_id: "prof-001",
      platform: "instagram",
      account_id: "acc-001",
      created_at: "2026-08-03T15:14:57Z",
      metadata: {
        messageId: "msg-out-001",
        conversationId: "conv-001",
        senderName: "Me",
        messagePreview: "Thanks!",
        source: "me",
      },
    };

    const result = normalizeZernioPayload(structuredClone(compactPayload));
    const msg = result.message as Record<string, unknown>;
    expect(msg.direction).toBe("outgoing");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalPayload = {
      action: "message.received",
      metadata: {},
    };

    const result = normalizeZernioPayload(structuredClone(minimalPayload));

    const msg = result.message as Record<string, unknown>;
    expect(msg.direction).toBe("outgoing"); // source not set → outgoing
    expect(msg.text).toBe("");
    expect(msg.id).toBe("");

    const sender = msg.sender as Record<string, unknown>;
    expect(sender.name).toBe("");
    expect(sender.phoneNumber).toBe("");
  });
});
