import { NextResponse } from "next/server";
import {
  getAssistantConversationById,
  getAssistantConversationsForWebsite,
  getAssistantMessages,
} from "@/lib/supabase/assistant-context";
import { isSupabaseAdminConfigured } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase/server";
import { getOwnedWebsiteForCurrentUser, getWebsiteAccessErrorResponse } from "@/lib/supabase/website-access";

interface ConversationBody {
  websiteId?: unknown;
  conversationId?: unknown;
}

function getWebsiteId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured. Conversations cannot be saved permanently." },
      { status: 503 },
    );
  }

  let body: ConversationBody;
  try {
    body = (await request.json()) as ConversationBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalid." }, { status: 400 });
  }

  const websiteId = getWebsiteId(body.websiteId);
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId is required." }, { status: 422 });
  }

  try {
    const { organizationId } = await getOwnedWebsiteForCurrentUser(websiteId);
    const supabase = createAdminClient();
    const title = `SEO Conversation ${new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())}`;

    const { data, error } = await supabase
      .from("assistant_conversations")
      .insert({
        website_id: websiteId,
        organization_id: organizationId,
        title,
      })
      .select("id, website_id, title, created_at, updated_at")
      .single();

    if (error) throw error;

    const conversation = await getAssistantConversationById(websiteId, data.id);
    const conversations = await getAssistantConversationsForWebsite(websiteId);

    return NextResponse.json({
      data: {
        conversation,
        conversations,
        messages: [],
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;

    console.error("[assistant/conversations] Conversation could not be created:", error);
    return NextResponse.json(
      { error: "The new conversation could not be created." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Platform storage is not configured. The conversation cannot be deleted." },
      { status: 503 },
    );
  }

  let body: ConversationBody;
  try {
    body = (await request.json()) as ConversationBody;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalid." }, { status: 400 });
  }

  const websiteId = getWebsiteId(body.websiteId);
  const conversationId = getWebsiteId(body.conversationId);
  if (!websiteId || !conversationId) {
    return NextResponse.json(
      { error: "websiteId and conversationId are required." },
      { status: 422 },
    );
  }

  try {
    await getOwnedWebsiteForCurrentUser(websiteId);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("assistant_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("website_id", websiteId);

    if (error) throw error;

    const conversations = await getAssistantConversationsForWebsite(websiteId);
    const nextConversation = conversations[0] ?? null;
    const messages = await getAssistantMessages(nextConversation?.id);

    return NextResponse.json({
      data: {
        conversation: nextConversation,
        conversations,
        messages,
      },
    });
  } catch (error) {
    const accessErrorResponse = getWebsiteAccessErrorResponse(error);
    if (accessErrorResponse) return accessErrorResponse;

    console.error("[assistant/conversations] Conversation could not be deleted:", error);
    return NextResponse.json(
      { error: "The conversation could not be deleted." },
      { status: 500 },
    );
  }
}
