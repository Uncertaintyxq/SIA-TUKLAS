/**
 * MessagesPage — /messages and /messages/:id. The communication & chat center: 1-on-1 chats between
 * students and educators, and the channels of your research groups, with search. Desktop shows the list
 * beside the open conversation; phones show one at a time.
 */
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import { MessagesSquare } from 'lucide-react';
import { ChatView } from '../components/chat/ChatView';
import { ConversationList } from '../components/chat/ConversationList';
import styles from './MessagesPage.module.css';

export function MessagesPage() {
  const id = Number(useParams().id) || null;

  return (
    <div className={clsx(styles.page, id && styles.open)}>
      <h1 className="sr-only">Messages</h1>
      <aside className={styles.list} aria-label="Conversations">
        <ConversationList activeId={id} />
      </aside>
      <div className={styles.conversation}>
        {id ? (
          <ChatView key={id} conversationId={id} backTo="/messages" />
        ) : (
          <div className={styles.placeholder}>
            <MessagesSquare size={36} aria-hidden="true" className={styles.placeholderIcon} />
            <p className={styles.placeholderTitle}>Pick a conversation</p>
            <p className={styles.placeholderText}>Or start a new one with the pencil button. Files you share in a group channel also land in the group’s files.</p>
          </div>
        )}
      </div>
    </div>
  );
}
