import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { ChatStatus, UIMessage } from "ai";
import { ArrowUp, Copy, MessageCircle, Trash2, Coins, Droplets, Wrench } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ISSUE_TYPES, ISSUE_LABELS, type IssueType } from "@/lib/issues";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/case-ui";
import { chatWithRentResolve } from "@/lib/chat.functions";
import { LEGAL_SOURCES, sourceControlledNotes } from "@/lib/legal-sources";
import type { ChatEvent } from "@/lib/chat-schema";
import { depositChat } from "@/lib/deposit-chat.functions";
import { answerField, caseFromChat, chatCaseSchema, DEPOSIT_WORKFLOW, emptyChatCase, type ChatCase, type DepositField } from "@/lib/chat-case";
import { DepositChatPanel } from "@/components/deposit-chat-panel";
import { useCase } from "@/lib/case-store";
import door from "@/assets/door.jpg";

const KEY = "rentresolve-chat-v1";
const DEPOSIT_KEY = "rentresolve-deposit-chat-v1";
const messageText = (message: UIMessage) =>
  message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");

export function RentChat() {
  const { current: activeCase, setCase } = useCase();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<ChatCase>(emptyChatCase);
  const [issue, setIssue] = useState<IssueType | null>(null);
  const guidance = sourceControlledNotes([{ sourceId: issue === "deposit" ? "govuk-deposit-protection" : "govuk-repairs" }]);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<AbortController | null>(null);
  const callChat = useServerFn(chatWithRentResolve);
  const callDepositChat = useServerFn(depositChat);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    try {
      const savedIssue = localStorage.getItem("rentresolve-chat-issue");
      if (ISSUE_TYPES.includes(savedIssue as IssueType)) setIssue(savedIssue as IssueType);
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const stored: UIMessage[] = JSON.parse(raw);
        if (
          Array.isArray(stored) &&
          stored.every(
            (message) =>
              typeof message.id === "string" &&
              ["user", "assistant"].includes(message.role) &&
              Array.isArray(message.parts),
          )
        )
          setMessages(stored);
      }
      const depositRaw = localStorage.getItem(DEPOSIT_KEY);
      if (depositRaw && savedIssue === "deposit") {
        const stored = JSON.parse(depositRaw);
        const parsed = chatCaseSchema.safeParse(stored.memory);
        if (parsed.success && Array.isArray(stored.messages)) {
          setMemory(parsed.data);
          setMessages(stored.messages);
        }
      }
    } catch {
      setNotice("Your saved chat could not be opened.");
    }
    setReady(true);
    textarea.current?.focus();
    return () => {
      pending.current?.abort();
    };
  }, []);

  const save = (next: UIMessage[], nextMemory = memory) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      if (issue === "deposit") localStorage.setItem(DEPOSIT_KEY, JSON.stringify({ messages: next, memory: nextMemory }));
    } catch {
      setNotice("This browser could not save your chat.");
    }
  };

  const submit = async ({ text }: { text: string }, nextMemory = memory, answerMode: "chat" | "reviewed" = "chat") => {
    if (!text.trim() || !consent || busy || !ready || !issue) return;
    const controller = new AbortController();
    pending.current = controller;
    const user: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: text.trim() }],
    };
    const history = [...messages, user];
    const replyId = crypto.randomUUID();
    setMessages(history);
    save(history, nextMemory);
    setDraft("");
    setError("");
    setNotice("");
    setStatus("submitted");
    textarea.current?.focus();
    let reply = "";
    let completed = false;
    try {
      if (issue === "deposit") {
        const result = await callDepositChat({ data: {
          consent: true, issueType: "deposit", memory: nextMemory, answerMode,
          messages: history.map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: messageText(message) })),
        }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!result.ok) throw new Error(result.message);
        setMemory(result.memory);
        const updated: UIMessage[] = [...history, { id: replyId, role: "assistant", parts: [{ type: "text", text: result.acknowledgement || "Thanks. Your answers are recorded below for you to check." }] }];
        setMessages(updated);
        save(updated, result.memory);
        return;
      }
      const response = await callChat({
        data: {
          consent: true,
          issueType: issue,
          messages: history.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: messageText(message),
          })),
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("The chat service could not be reached.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (controller.signal.aborted) break;
        buffer += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event: ChatEvent = JSON.parse(line);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") completed = true;
          if (event.type === "text") {
            reply += event.text;
            setStatus("streaming");
            setMessages([
              ...history,
              { id: replyId, role: "assistant", parts: [{ type: "text", text: reply }] },
            ]);
          }
        }
        if (chunk.done) break;
      }
      if (!completed && !controller.signal.aborted)
        throw new Error("The reply was incomplete. Please check it before continuing.");
      if (completed && !controller.signal.aborted)
        save([
          ...history,
          { id: replyId, role: "assistant", parts: [{ type: "text", text: reply }] },
        ]);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "The reply could not be completed.");
        setDraft(text);
      }
    } finally {
      if (!controller.signal.aborted) {
        setStatus("ready");
        pending.current = null;
        textarea.current?.focus();
      }
    }
  };

  const editField = (field: DepositField, value: string, skip = false) => {
    try {
      const next = answerField(memory, field, value, skip);
      setMemory(next);
      save(messages, next);
      setError("");
      return next;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please check your answer.");
      return null;
    }
  };
  const answer = (field: DepositField, value: string, skip = false) => {
    const next = editField(field, value, skip);
    if (!next) return;
    void submit({ text: skip ? `I’m not sure about ${DEPOSIT_WORKFLOW[field].label.toLowerCase()}; skip this for now.` : `${DEPOSIT_WORKFLOW[field].label}: ${value}` }, next, "reviewed");
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={door}
            alt="RentResolve's English house"
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div>
            <h1 className="text-2xl font-semibold">RentResolve</h1>
            <p className="text-sm text-muted-foreground">Your tenancy dispute, made clearer.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear chat"
            title="Clear chat"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Delete this chat from this browser?")) return;
              setMessages([]);
              setReviewed([]);
              setError("");
              localStorage.removeItem(KEY);
              localStorage.removeItem(DEPOSIT_KEY);
              setMemory(emptyChatCase());
              textarea.current?.focus();
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="py-7 text-center">
          <Button
            variant="secondary"
            size="icon"
            className="h-14 w-14 rounded-full"
            aria-label="Get started"
            title="Get started"
            onClick={() => textarea.current?.focus()}
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
          <h2 className="mt-4 text-3xl font-semibold">Get started</h2>
          <p className="mt-2 text-muted-foreground">Which tenancy issue would you like to discuss?</p>
        </div>
      ) : (
        <Conversation className="h-[min(52dvh,640px)] min-h-64" initial="instant" resize="instant">
          <ConversationContent className="gap-6 px-0">
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent className="text-base group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index} controls={false}>
                        {part.text}
                      </MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
                {message.role === "assistant" && !busy && (
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer">Review & edit reply</summary>
                    <div className="mt-3 space-y-3">
                      <EditableText
                        label="AI reply"
                        value={messageText(message)}
                        onSave={(text) => {
                          const next = messages.map((item) =>
                            item.id === message.id
                              ? { ...item, parts: [{ type: "text" as const, text }] }
                              : item,
                          );
                          setMessages(next);
                          save(next);
                          setReviewed((ids) => ids.filter((id) => id !== message.id));
                        }}
                      />
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={reviewed.includes(message.id)}
                          onChange={(event) =>
                            setReviewed((ids) =>
                              event.target.checked
                                ? [...ids, message.id]
                                : ids.filter((id) => id !== message.id),
                            )
                          }
                        />
                        I have checked this reply before using it.
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!reviewed.includes(message.id)}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(messageText(message));
                            setNotice("Reply copied.");
                          } catch {
                            setNotice("This browser could not copy the reply.");
                          }
                        }}
                      >
                        <Copy />
                        Copy reviewed reply
                      </Button>
                    </div>
                  </details>
                )}
              </Message>
            ))}
            {status === "submitted" && <Shimmer>Thinking…</Shimmer>}
            {issue === "deposit" && <DepositChatPanel memory={memory} busy={busy} canSend={consent && ready} onAnswer={answer} onEdit={editField} onSave={() => {
              try {
                if (activeCase && activeCase.issueType && activeCase.issueType !== "deposit" && !window.confirm("Replace your current case? Its saved evidence will be removed from this device.")) return;
                setCase(caseFromChat(memory, activeCase));
                void navigate({ to: "/dashboard" });
              } catch (failure) { setError(failure instanceof Error ? failure.message : "Please check your summary."); }
            }} />}
          </ConversationContent>
          <ConversationScrollButton aria-label="Latest message" />
        </Conversation>
      )}

      <div className="my-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Tenancy issue">
        {ISSUE_TYPES.map(type => { const Icon = type === "deposit" ? Coins : type === "damp" ? Droplets : Wrench; return <Button key={type} variant={issue === type ? "default" : "outline"} aria-pressed={issue === type} disabled={busy} onClick={() => {
          if (issue !== type && messages.length && !confirm("Changing issue clears the current chat. Continue?")) return;
          if (issue !== type) { setMessages([]); save([], emptyChatCase()); setMemory(emptyChatCase()); localStorage.removeItem(DEPOSIT_KEY); setReviewed([]); setDraft(""); setError(""); setConsent(false); }
          setIssue(type); localStorage.setItem("rentresolve-chat-issue", type); textarea.current?.focus();
        }}><Icon className="h-4 w-4" />{ISSUE_LABELS[type]}</Button>; })}
      </div>
      {issue && <div className="mb-4 text-center"><Button asChild variant="secondary"><Link to="/intake" search={{ issue }}>Start guided intake</Link></Button></div>}

      <PromptInput
        onSubmit={(message) => submit(message)}
        className="mt-4 [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-card"
      >
        <PromptInputTextarea
          ref={textarea}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Message RentResolve"
          placeholder={issue ? `Tell me about ${ISSUE_LABELS[issue].toLowerCase()}…` : "Choose a tenancy issue above…"}
          disabled={!issue}
          className="min-h-24 px-4 text-base"
        />
        <PromptInputFooter className="justify-end px-3 pb-3">
          <PromptInputSubmit
            status={status}
            aria-label={busy ? "Stop reply" : "Send message"}
            className="h-9 w-9 shrink-0"
            disabled={!busy && (!draft.trim() || !consent || !ready || !issue)}
            onStop={() => {
              pending.current?.abort();
              pending.current = null;
              setStatus("ready");
              setNotice("Reply stopped. Partial text has not been saved.");
              textarea.current?.focus();
            }}
            title={busy ? "Stop reply" : "Send message"}
          >
            {!busy && <ArrowUp />}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      <label className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 shrink-0"
        />
        I agree to send my messages, case answers and chat history to the AI service. Chat history is saved on
        this device; avoid sensitive personal details.
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <details className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
        <summary className="cursor-pointer">
          Maintained legal guidance · separate from AI replies
        </summary>
        {guidance.map((note) => (
          <div key={note.sourceId} className="mt-3">
            <p>{note.explanation}</p>
            {LEGAL_SOURCES.filter((source) => source.id === note.sourceId).map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block underline"
              >
                {source.title} · reviewed {"lastReviewed" in source ? source.lastReviewed : "date unavailable"}
              </a>
            ))}
          </div>
        ))}
        <p className="mt-3">
          AI replies can be wrong. This is general information, not legal advice or a guarantee of
          authenticity.
        </p>
      </details>
    </section>
  );
}
