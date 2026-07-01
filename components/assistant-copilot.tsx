"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clipboard,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AssistantContextSnapshot,
  AssistantConversation,
  AssistantMessage,
  Website,
} from "@/types";

const quickQuestions = [
  "assistant.qGrowth",
  "assistant.qPage",
  "assistant.qKeyword",
  "assistant.qAnalyze",
  "assistant.qPlan",
  "assistant.qIssues",
  "assistant.qIndexed",
  "assistant.qTop3",
] as const;

const contextLabels: Array<[keyof AssistantContextSnapshot["contextFlags"], string]> = [
  ["crawl", "Crawl"],
  ["searchConsole", "Search Console"],
  ["keywords", "Keywords"],
  ["aiContent", "AI Content"],
  ["auditSeo", "Audit SEO"],
  ["generatedPages", "Generated Pages"],
  ["recommendations", "Recommendations"],
];

const quickActions = [
  "Run Crawl",
  "Generate Page",
  "Optimize",
  "View Keywords",
  "Open Audit",
] as const;

type CopilotAction = (typeof quickActions)[number];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AssistantCopilotProps {
  websites: Website[];
  conversation: AssistantConversation | null;
  conversations: AssistantConversation[];
  messages: AssistantMessage[];
  initialContext: AssistantContextSnapshot;
}

interface StreamMeta {
  conversationId?: string;
  contextFlags?: AssistantContextSnapshot["contextFlags"];
  sidebar?: {
    seoScore: number | null;
    pagesIndexed: number;
    pagesNotIndexed: number;
    primaryKeyword: string | null;
    lastCrawl: AssistantContextSnapshot["lastCrawl"];
    lastAudit: AssistantContextSnapshot["lastAudit"];
  };
}

interface BootstrapResponse {
  data?: {
    conversation: AssistantConversation | null;
    conversations: AssistantConversation[];
    messages: AssistantMessage[];
    context: AssistantContextSnapshot;
  };
  error?: string;
}

interface ConversationMutationResponse {
  data?: {
    conversation: AssistantConversation | null;
    conversations: AssistantConversation[];
    messages: AssistantMessage[];
  };
  error?: string;
}

function renderMarkdownLite(content: string) {
  const blocks = content.split(/```/g);
  return blocks.map((block, index) => {
    if (index % 2 === 1) {
      return (
        <pre key={index} className="my-3 overflow-auto rounded-xl border bg-background/70 p-3 text-xs">
          <code>{block.replace(/^[a-z]+\n/i, "")}</code>
        </pre>
      );
    }

    return (
      <div key={index} className="whitespace-pre-wrap leading-7">
        {block}
      </div>
    );
  });
}

export function AssistantCopilot({
  websites,
  conversation,
  conversations: initialConversations,
  messages,
  initialContext,
}: AssistantCopilotProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [websiteId, setWebsiteId] = useState(initialContext.website?.id ?? websites[0]?.id ?? "");
  const [conversationId, setConversationId] = useState<string | null>(conversation?.id ?? null);
  const [conversationSummary, setConversationSummary] = useState<AssistantConversation | null>(conversation);
  const [conversationHistory, setConversationHistory] = useState<AssistantConversation[]>(initialConversations);
  const [deleteTarget, setDeleteTarget] = useState<AssistantConversation | null>(null);
  const [isMutatingConversation, setIsMutatingConversation] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    messages.length
      ? messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        }))
      : [
          {
            id: "intro",
            role: "assistant",
            content: t("assistant.welcome"),
          },
        ],
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<CopilotAction, "idle" | "running" | "done" | "error">>({
    "Run Crawl": "idle",
    "Generate Page": "idle",
    Optimize: "idle",
    "View Keywords": "idle",
    "Open Audit": "idle",
  });
  const [contextFlags, setContextFlags] = useState(initialContext.contextFlags);
  const [sidebar, setSidebar] = useState({
    seoScore: initialContext.seoScore,
    pagesIndexed: initialContext.pagesIndexed,
    pagesNotIndexed: initialContext.pagesNotIndexed,
    primaryKeyword: initialContext.primaryKeyword,
    lastCrawl: initialContext.lastCrawl,
    lastAudit: initialContext.lastAudit,
  });
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");

  const selectedWebsite = useMemo(
    () => websites.find((website) => website.id === websiteId) ?? websites[0],
    [websiteId, websites],
  );

  const lastAssistantText = [...chatMessages].reverse().find((message) => message.role === "assistant")?.content ?? "";

  async function loadWebsiteConversation(nextConversationId?: string | null) {
    if (!websiteId) return;

    setError(null);
    setIsStreaming(false);
    setChatMessages([
      {
        id: "loading-conversation",
        role: "assistant",
        content: "",
      },
    ]);

    try {
      const params = new URLSearchParams({ websiteId });
      if (nextConversationId) params.set("conversationId", nextConversationId);
      const response = await fetch(`/api/assistant/chat?${params.toString()}`);
      const payload = (await response.json()) as BootstrapResponse;
      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error ?? t("assistant.loadFailed"));
      }

      setConversationId(payload.data.conversation?.id ?? null);
      setConversationSummary(payload.data.conversation);
      setConversationHistory(payload.data.conversations);
      setContextFlags(payload.data.context.contextFlags);
      setSidebar({
        seoScore: payload.data.context.seoScore,
        pagesIndexed: payload.data.context.pagesIndexed,
        pagesNotIndexed: payload.data.context.pagesNotIndexed,
        primaryKeyword: payload.data.context.primaryKeyword,
        lastCrawl: payload.data.context.lastCrawl,
        lastAudit: payload.data.context.lastAudit,
      });
      setChatMessages(
        payload.data.messages.length
          ? payload.data.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
            }))
          : [
              {
                id: "intro",
                role: "assistant",
                content: t("assistant.welcome"),
              },
            ],
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("assistant.loadFailed"));
      setChatMessages([]);
    }
  }

  useEffect(() => {
    void loadWebsiteConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  async function createNewConversation() {
    if (!websiteId || isMutatingConversation) return;
    setIsMutatingConversation(true);
    setError(null);

    try {
      const response = await fetch("/api/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const payload = (await response.json()) as ConversationMutationResponse;
      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error ?? t("assistant.newFailed"));
      }

      setConversationId(payload.data.conversation?.id ?? null);
      setConversationSummary(payload.data.conversation);
      setConversationHistory(payload.data.conversations);
      setChatMessages([
        {
          id: "intro",
          role: "assistant",
          content: t("assistant.welcome"),
        },
      ]);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("assistant.newFailed"));
    } finally {
      setIsMutatingConversation(false);
    }
  }

  async function deleteConversation() {
    if (!websiteId || !deleteTarget || isMutatingConversation) return;
    setIsMutatingConversation(true);
    setError(null);

    try {
      const response = await fetch("/api/assistant/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, conversationId: deleteTarget.id }),
      });
      const payload = (await response.json()) as ConversationMutationResponse;
      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error ?? t("assistant.deleteFailed"));
      }

      setDeleteTarget(null);
      setConversationId(payload.data.conversation?.id ?? null);
      setConversationSummary(payload.data.conversation);
      setConversationHistory(payload.data.conversations);
      setChatMessages(
        payload.data.messages.length
          ? payload.data.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
            }))
          : [
              {
                id: "intro",
                role: "assistant",
                content: t("assistant.welcome"),
              },
            ],
      );
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : t("assistant.deleteFailed"));
    } finally {
      setIsMutatingConversation(false);
    }
  }

  function addSystemMessage(content: string) {
    setChatMessages((current) => [
      ...current,
      {
        id: `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "assistant",
        content,
      },
    ]);
  }

  function setSingleActionStatus(action: CopilotAction, status: "idle" | "running" | "done" | "error") {
    setActionStatus((current) => ({ ...current, [action]: status }));
  }

  function inferKeywordFromContext() {
    const candidates = [
      sidebar.primaryKeyword,
      ...[...lastAssistantText.matchAll(/[„"]([^„”"]{3,80})[”"]|`([^`]{3,80})`/g)].map(
        (match) => match[1] ?? match[2],
      ),
    ].filter(Boolean) as string[];

    return candidates.find((candidate) => candidate.length > 2) ?? null;
  }

  async function pollCrawl(crawlId: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await fetch(`/api/crawl?id=${crawlId}`);
      const payload = (await response.json()) as {
        data?: {
          status: "pending" | "running" | "completed" | "failed";
          pagesDiscovered: number;
          pagesCrawled: number;
          issuesFound: number;
          progress: number;
          errorMessage: string | null;
        };
        error?: string;
      };

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error ?? t("assistant.crawlProgressFailed"));
      }

      if (attempt % 5 === 0 || payload.data.status === "completed" || payload.data.status === "failed") {
        addSystemMessage(
          `**Crawl status:** ${payload.data.status}\n\nProgres: ${payload.data.progress}%\nPagini scanate: ${payload.data.pagesCrawled}\nProbleme detectate: ${payload.data.issuesFound}`,
        );
      }

      if (payload.data.status === "completed") return payload.data;
      if (payload.data.status === "failed") {
        throw new Error(payload.data.errorMessage ?? t("assistant.crawlFailed"));
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    throw new Error(t("assistant.crawlTimeout"));
  }

  async function runCrawlAction() {
    if (!selectedWebsite) return;
    setSingleActionStatus("Run Crawl", "running");
    addSystemMessage(`${t("assistant.crawlRunning")} **${selectedWebsite.name}**...\n\n${t("assistant.crawlUrl")}: ${selectedWebsite.url}`);

    try {
      const response = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedWebsite.id, url: selectedWebsite.url }),
      });
      const payload = (await response.json()) as { data?: { crawlId: string }; error?: string };
      if (!response.ok || payload.error || !payload.data?.crawlId) {
        throw new Error(payload.error ?? t("assistant.crawlStartFailed"));
      }

      const result = await pollCrawl(payload.data.crawlId);
      setSingleActionStatus("Run Crawl", "done");
      addSystemMessage(
        `${t("assistant.completed")}\n\nCrawl for **${selectedWebsite.name}**:\n- ${t("assistant.pagesDiscovered")}: ${result.pagesDiscovered}\n- ${t("assistant.pagesScanned")}: ${result.pagesCrawled}\n- ${t("assistant.seoIssues")}: ${result.issuesFound}`,
      );
    } catch (actionError) {
      setSingleActionStatus("Run Crawl", "error");
      addSystemMessage(`${t("assistant.crawlError")}: ${actionError instanceof Error ? actionError.message : t("reports.unavailable")}`);
    }
  }

  async function generatePageAction() {
    if (!selectedWebsite) return;
    const keyword = inferKeywordFromContext();
    if (!keyword) {
      addSystemMessage(t("assistant.chooseKeyword"));
      return;
    }

    setSingleActionStatus("Generate Page", "running");
    addSystemMessage(`${t("assistant.generatingPageFor")} **${keyword}** ${t("assistant.onWebsite")} **${selectedWebsite.name}**...`);

    try {
      const response = await fetch("/api/content/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedWebsite.id, keyword }),
      });
      const payload = (await response.json()) as { data?: { page: { id: string; slug?: string } }; error?: string; warning?: string };
      if (!response.ok || payload.error || !payload.data?.page?.id) {
        throw new Error(payload.error ?? t("assistant.pageGenerateFailed"));
      }

      const href = `/content/generated?websiteId=${selectedWebsite.id}&pageId=${payload.data.page.id}`;
      setSingleActionStatus("Generate Page", "done");
      addSystemMessage(`${t("assistant.completed")}\n\n${t("assistant.pageGenerated")} **${keyword}**.\n\n${t("assistant.openEditor")}: ${href}`);
      router.push(href);
    } catch (actionError) {
      setSingleActionStatus("Generate Page", "error");
      addSystemMessage(`${t("assistant.pageGenerateError")}: ${actionError instanceof Error ? actionError.message : t("reports.unavailable")}`);
    }
  }

  function optimizeAction() {
    setSingleActionStatus("Optimize", "running");
    const href = `/content/generated?websiteId=${websiteId}`;
    addSystemMessage(`${t("assistant.openingSeoEditor")}\n\n${t("assistant.page")}: ${href}`);
    setSingleActionStatus("Optimize", "done");
    router.push(href);
  }

  function executeAction(action: CopilotAction) {
    if (action === "Run Crawl") void runCrawlAction();
    if (action === "Generate Page") void generatePageAction();
    if (action === "Optimize") optimizeAction();
    if (action === "View Keywords") {
      setSingleActionStatus(action, "done");
      router.push(`/keywords?websiteId=${websiteId}`);
    }
    if (action === "Open Audit") {
      setSingleActionStatus(action, "done");
      router.push(`/audit?websiteId=${websiteId}`);
    }
  }

  function actionDisplayLabel(action: CopilotAction) {
    if (action === "Run Crawl") return t("assistant.actionCrawl");
    if (action === "Generate Page") return t("assistant.actionPage");
    if (action === "Optimize") return t("assistant.actionOptimize");
    if (action === "View Keywords") return t("assistant.actionKeywords");
    return t("assistant.actionAudit");
  }

  function actionLabel(action: CopilotAction) {
    const status = actionStatus[action];
    const label = actionDisplayLabel(action);
    if (status === "running") return `${label} - ${t("assistant.running")}`;
    if (status === "done") return `${label} - ${t("assistant.done")}`;
    if (status === "error") return `${label} - ${t("assistant.error")}`;
    return label;
  }

  async function sendMessage(value?: string) {
    const prompt = (value ?? input).trim();
    if (!prompt || isStreaming) return;

    lastPromptRef.current = prompt;
    setInput("");
    setError(null);
    setIsStreaming(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    };
    const assistantId = `assistant-${Date.now()}`;
    setChatMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, message: prompt, conversationId }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(t("assistant.streamFailed"));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const eventText of events) {
          const eventLine = eventText.split("\n").find((line) => line.startsWith("event: "));
          const dataLine = eventText.split("\n").find((line) => line.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace("event: ", "");
          const data = JSON.parse(dataLine.replace("data: ", "")) as
            | { text?: string; message?: string; reportId?: string }
            | StreamMeta
            | { error?: string; conversationId?: string; messageId?: string };

          if (event === "meta") {
            const meta = data as StreamMeta;
            if (meta.conversationId) setConversationId(meta.conversationId);
            if (meta.contextFlags) setContextFlags(meta.contextFlags);
            if (meta.sidebar) setSidebar(meta.sidebar);
          }

          if (event === "token" && "text" in data && data.text) {
            setChatMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + data.text }
                  : message,
              ),
            );
          }

          if (event === "report" && "message" in data && data.message) {
            setChatMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, content: data.message ?? message.content }
                  : message,
              ),
            );
          }

          if (event === "error" && "error" in data) {
            setError(data.error ?? t("assistant.genericError"));
          }

          if (event === "done") {
            const now = new Date().toISOString();
            setConversationSummary((current) =>
              current
                ? {
                    ...current,
                    messageCount: (current.messageCount ?? chatMessages.length) + 2,
                    updatedAt: now,
                  }
                : current,
            );
            setConversationHistory((current) =>
              current.map((conversation) =>
                conversation.id === conversationId
                  ? {
                      ...conversation,
                      messageCount: (conversation.messageCount ?? 0) + 2,
                      updatedAt: now,
                    }
                  : conversation,
              ),
            );
          }
        }
      }
    } catch (streamError) {
      if ((streamError as Error).name !== "AbortError") {
        setError(streamError instanceof Error ? streamError.message : t("assistant.failed"));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function abort() {
    abortRef.current?.abort();
    setIsStreaming(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <aside className="space-y-4">
        <Card className="p-4">
          <p className="text-sm font-semibold">{t("assistant.activeWebsite")}</p>
          <select
            className="mt-3 h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={websiteId}
            onChange={(event) => {
              setWebsiteId(event.target.value);
              setConversationId(null);
              setConversationSummary(null);
              setConversationHistory([]);
            }}
          >
            {websites.map((website) => (
              <option key={website.id} value={website.id}>
                {website.name}
              </option>
            ))}
          </select>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-semibold">{t("assistant.websiteSummary")}</p>
          <div className="mt-4 grid gap-3">
            <Metric label="Website" value={selectedWebsite?.name ?? "N/A"} />
            <Metric label="SEO Score" value={sidebar.seoScore?.toString() ?? "N/A"} />
            <Metric label={t("assistant.lastCrawl")} value={sidebar.lastCrawl?.createdAt ? new Date(sidebar.lastCrawl.createdAt).toLocaleString(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "short", timeStyle: "short" }) : "N/A"} />
            <Metric label={t("assistant.lastAudit")} value={sidebar.lastAudit?.completedAt ? new Date(sidebar.lastAudit.completedAt).toLocaleString(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "short", timeStyle: "short" }) : "N/A"} />
            <Metric label={t("assistant.messages")} value={(conversationSummary?.messageCount ?? chatMessages.filter((message) => message.id !== "intro").length).toString()} />
            <Metric label={t("assistant.lastActivity")} value={conversationSummary?.updatedAt ? new Date(conversationSummary.updatedAt).toLocaleString(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "short", timeStyle: "short" }) : "N/A"} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("assistant.history")}</p>
            <Button variant="outline" size="sm" onClick={createNewConversation} disabled={isMutatingConversation}>
              {isMutatingConversation ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t("assistant.new")}
            </Button>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {conversationHistory.length === 0 ? (
              <p className="rounded-xl border bg-secondary/20 p-3 text-xs text-muted-foreground">
                {t("assistant.noSavedConversations")}
              </p>
            ) : (
              conversationHistory.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "rounded-xl border bg-secondary/20 p-2 transition",
                    conversation.id === conversationId && "border-primary bg-primary/10",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => loadWebsiteConversation(conversation.id)}
                    disabled={isStreaming}
                  >
                    <span className="line-clamp-1 text-xs font-semibold">{conversation.title}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {new Date(conversation.updatedAt).toLocaleString(locale === "ro" ? "ro-RO" : "en-US", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {t("assistant.messages")}: {conversation.messageCount ?? 0}
                    </span>
                  </button>
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(conversation)}
                      disabled={isMutatingConversation}
                    >
                      <Trash2 className="size-3.5" />
                      {t("assistant.delete")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </aside>

      <section className="flex min-h-[720px] flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Bot className="size-5" />
            </span>
            <div>
              <h3 className="font-[var(--font-manrope)] text-xl font-bold">VILM AI SEO Copilot</h3>
              <p className="text-sm text-muted-foreground">
                {t("assistant.subtitle")} {selectedWebsite?.name ?? "website"}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question) => (
              <Button
                key={question}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(t(question))}
                disabled={isStreaming}
              >
                {t(question)}
              </Button>
            ))}
          </div>

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[88%] rounded-2xl border p-4",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-secondary/30",
              )}
            >
              <div className="prose prose-invert max-w-none text-sm">
                {message.content ? renderMarkdownLite(message.content) : (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t("assistant.analyzing")}
                  </span>
                )}
              </div>
              {message.role === "assistant" && message.content && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(message.content)}
                  >
                    <Clipboard className="size-3.5" />
                    {t("assistant.copy")}
                  </Button>
                  {quickActions.map((action) => (
                    <Button
                      key={action}
                      variant="outline"
                      size="sm"
                      onClick={() => executeAction(action)}
                      disabled={actionStatus[action] === "running"}
                    >
                      {actionStatus[action] === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                      {actionLabel(action)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => sendMessage(lastPromptRef.current)}>
                <RefreshCcw className="size-3.5" />
                {t("assistant.retry")}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <div className="flex gap-3">
            <textarea
              className="min-h-12 flex-1 resize-none rounded-xl border bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder={t("assistant.placeholder")}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            {isStreaming ? (
              <Button variant="destructive" onClick={abort}>
                <Square className="size-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={() => sendMessage()}>
                <Send className="size-4" />
                {t("assistant.send")}
              </Button>
            )}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <Card className="p-4">
          <p className="text-sm font-semibold">{t("assistant.contextUsed")}</p>
          <div className="mt-4 space-y-2">
            {contextLabels.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border bg-secondary/20 p-3">
                <span className="text-sm">{label}</span>
                {contextFlags[key] ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <span className="text-xs text-muted-foreground">{t("assistant.missing")}</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold">{t("assistant.websiteRecap")}</p>
          <div className="mt-4 grid gap-3">
            <Metric label="SEO Score" value={sidebar.seoScore?.toString() ?? "N/A"} />
            <Metric label={t("assistant.indexedPages")} value={sidebar.pagesIndexed.toString()} />
            <Metric label={t("assistant.notIndexedPages")} value={sidebar.pagesNotIndexed.toString()} />
            <Metric label={t("assistant.primaryKeyword")} value={sidebar.primaryKeyword ?? "N/A"} />
            <Metric label={t("assistant.lastCrawl")} value={sidebar.lastCrawl?.createdAt ? new Date(sidebar.lastCrawl.createdAt).toLocaleDateString(locale === "ro" ? "ro-RO" : "en-US") : "N/A"} />
            <Metric label={t("assistant.lastAudit")} value={sidebar.lastAudit?.completedAt ? new Date(sidebar.lastAudit.completedAt).toLocaleDateString(locale === "ro" ? "ro-RO" : "en-US") : "N/A"} />
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold">{t("assistant.quickActions")}</p>
          <div className="mt-4 grid gap-2">
            {quickActions.map((action) => (
              <Button
                key={action}
                variant="outline"
                className="justify-start"
                onClick={() => executeAction(action)}
                disabled={actionStatus[action] === "running"}
              >
                {actionStatus[action] === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                {actionLabel(action)}
              </Button>
            ))}
          </div>
        </Card>
      </aside>

      <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40 focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold">{t("assistant.deleteTitle")}</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("assistant.deleteDescription")}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" disabled={isMutatingConversation}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="mt-5 rounded-xl border bg-secondary/20 p-3 text-sm">
              {deleteTarget?.title}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost" disabled={isMutatingConversation}>{t("content.cancel")}</Button>
              </Dialog.Close>
              <Button variant="destructive" onClick={deleteConversation} disabled={isMutatingConversation}>
                {isMutatingConversation ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t("assistant.delete")}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
