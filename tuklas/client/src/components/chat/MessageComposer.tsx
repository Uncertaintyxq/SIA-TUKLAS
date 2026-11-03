/**
 * MessageComposer — the text box at the foot of a chat or thread. Enter sends, Shift+Enter adds a line,
 * "@" suggests people to mention, the paperclip sends a file (with whatever is typed as its caption).
 */
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { LoaderCircle, Paperclip, SendHorizontal } from 'lucide-react';
import { useSendFile, useSendMessage } from '../../api/chat';
import { useMentionPicker } from '../ui/MentionInput';
import { useToast } from '../ui/Toast';
import styles from './MessageComposer.module.css';

export function MessageComposer({
  conversationId,
  parentId,
  placeholder,
  canMentionAll = false,
}: {
  conversationId: number;
  parentId?: number;
  placeholder: string;
  /** Offer "@everyone" (a group channel, for the group's organizers) */
  canMentionAll?: boolean;
}) {
  const [text, setText] = useState('');
  const send = useSendMessage();
  const sendFile = useSendFile();
  const toast = useToast();
  const busy = send.isPending || sendFile.isPending;
  const mention = useMentionPicker(text, setText, 'above', canMentionAll);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    send.mutate(
      { conversationId, text: body, parentId },
      {
        onSuccess: () => setText(''),
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter picks a suggested person while the list is open, instead of sending
    if (mention.onKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.composer} onSubmit={submit}>
      {/* Threads don't take files; they stay in the main conversation. */}
      {!parentId && (
        <label className={styles.attach} title="Send a file (up to 15 MB)">
          {sendFile.isPending ? <LoaderCircle size={19} className={styles.spin} aria-hidden="true" /> : <Paperclip size={19} aria-hidden="true" />}
          <span className="sr-only">Send a file</span>
          <input
            type="file"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              sendFile.mutate({ conversationId, file, text: text.trim() || undefined }, { onSuccess: () => setText(''), onError: (err) => toast(err.message, 'error') });
            }}
          />
        </label>
      )}
      <label className="sr-only" htmlFor={`compose-${conversationId}-${parentId ?? 0}`}>
        {placeholder}
      </label>
      <div className={`${mention.anchor} ${styles.field}`}>
        <textarea
          id={`compose-${conversationId}-${parentId ?? 0}`}
          className={styles.input}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={placeholder}
          {...mention.textareaProps}
          onKeyDown={onKeyDown}
        />
        {mention.list}
      </div>
      <button type="submit" className={styles.send} disabled={!text.trim() || busy}>
        <SendHorizontal size={19} aria-hidden="true" />
        <span className="sr-only">Send</span>
      </button>
    </form>
  );
}
