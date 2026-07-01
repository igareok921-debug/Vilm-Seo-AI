import { AssistantCopilot } from "@/components/assistant-copilot";
import { PageHeader } from "@/components/page-header";
import { getServerTranslator } from "@/lib/i18n/server";
import {
  buildAssistantContext,
  getAssistantConversationById,
  getAssistantConversationForWebsite,
  getAssistantConversationsForWebsite,
  getAssistantMessages,
} from "@/lib/supabase/assistant-context";
import { getWebsites } from "@/lib/supabase/websites";

export const metadata = { title: "AI SEO Copilot" };
export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams?: Promise<{ websiteId?: string; conversationId?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getServerTranslator();
  const { websites } = await getWebsites();
  const initialWebsite =
    websites.find((website) => website.id === params?.websiteId) ?? websites[0];
  const initialConversation = params?.conversationId
    ? await getAssistantConversationById(initialWebsite?.id ?? "", params.conversationId)
    : await getAssistantConversationForWebsite(initialWebsite?.id ?? "");
  const conversations = await getAssistantConversationsForWebsite(initialWebsite?.id ?? "");
  const [messages, initialContext] = await Promise.all([
    getAssistantMessages(initialConversation?.id),
    buildAssistantContext(initialWebsite?.id ?? ""),
  ]);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("assistant.eyebrow")}
        title={t("assistant.title")}
        description={t("assistant.description")}
      />
      <AssistantCopilot
        websites={websites}
        conversation={initialConversation}
        conversations={conversations}
        messages={messages}
        initialContext={initialContext}
      />
    </div>
  );
}
