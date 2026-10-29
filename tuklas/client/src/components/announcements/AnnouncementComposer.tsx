/**
 * AnnouncementComposer — write and post an announcement: audience, title, formatted body,
 * attachments and pinning. Posting alerts the audience in the app and by email.
 */
import { useState, type FormEvent } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import { useCreateAnnouncement, useUploadAttachment, type AnnouncementsResponse } from '../../api/announcements';
import { fileSize } from '../../lib/format';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { RichTextEditor } from './RichTextEditor';
import styles from './AnnouncementComposer.module.css';

const MAX_FILES = 5;

/** Audience options as select values: "system", "department:<name>", "group:<id>". */
function audienceOptions(a: AnnouncementsResponse['audiences']) {
  return [
    ...(a.system ? [{ value: 'system', label: 'Everyone on Tuklas' }] : []),
    ...a.departments.map((d) => ({ value: `department:${d}`, label: `Department · ${d}` })),
    ...a.groups.map((g) => ({ value: `group:${g.id}`, label: `Research group · ${g.name}` })),
  ];
}

export function AnnouncementComposer({
  audiences,
  fixedGroup,
  onDone,
}: {
  audiences: AnnouncementsResponse['audiences'];
  /** Post to this group only (the group page's composer) */
  fixedGroup?: { id: number; name: string };
  onDone: () => void;
}) {
  const options = fixedGroup ? [{ value: `group:${fixedGroup.id}`, label: `Research group · ${fixedGroup.name}` }] : audienceOptions(audiences);
  const [audience, setAudience] = useState(options[0]?.value ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<{ title?: string; body?: string }>({});
  const create = useCreateAnnouncement();
  const attach = useUploadAttachment();
  const toast = useToast();
  const busy = create.isPending || attach.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problems = { title: title.trim().length < 3 ? 'Give the announcement a title.' : undefined, body: body.trim() ? undefined : 'Write the announcement.' };
    setError(problems);
    if (problems.title || problems.body) return;
    const [scope, target] = audience.split(/:(.*)/s) as ['system' | 'department' | 'group', string | undefined];
    let id: number;
    try {
      ({ id } = await create.mutateAsync({
        scope,
        department: scope === 'department' ? target : undefined,
        groupId: scope === 'group' ? Number(target) : undefined,
        title,
        body,
        pinned,
      }));
    } catch (err) {
      toast((err as Error).message, 'error');
      return;
    }
    // The announcement is live now; a rejected file shouldn't invite a second, duplicate post.
    const failed: string[] = [];
    for (const file of files) await attach.mutateAsync({ id, file }).catch((err: Error) => failed.push(`${file.name}: ${err.message}`));
    if (failed.length) toast(`Posted, but ${failed.length === 1 ? 'a file' : 'some files'} couldn’t be attached. ${failed.join(' ')}`, 'error');
    else toast('Announcement posted. Your audience has been notified.', 'success');
    onDone();
  };

  return (
    <Sheet title="New announcement" className={styles.sheet}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {!fixedGroup && (
          <SelectField label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
        )}
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} error={error.title} placeholder="e.g. Lab meeting moved to Thursday" />
        <RichTextEditor label="Announcement" value={body} onChange={setBody} error={error.body} placeholder="What does your audience need to know?" />

        <div className={styles.files}>
          <label className={styles.attach} data-disabled={files.length >= MAX_FILES || undefined}>
            <Paperclip size={16} aria-hidden="true" />
            Attach files
            <input
              type="file"
              multiple
              className="sr-only"
              disabled={files.length >= MAX_FILES}
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])];
                e.target.value = '';
                setFiles((f) => [...f, ...picked].slice(0, MAX_FILES));
              }}
            />
          </label>
          <span className={styles.limit}>Up to {MAX_FILES} files, 15 MB each</span>
          {files.length > 0 && (
            <ul className={styles.fileList}>
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className={styles.file}>
                  <span className={styles.fileName}>{f.name}</span>
                  <span className={styles.limit}>{fileSize(f.size)}</span>
                  <button type="button" className={styles.remove} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                    <X size={15} aria-hidden="true" />
                    <span className="sr-only">Remove {f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className={styles.pin}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top of the feed
        </label>

        <Notice>Everyone in the audience gets an in-app alert and an email when you post.</Notice>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" icon={<Send size={16} aria-hidden="true" />} loading={busy}>
            Post announcement
          </Button>
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
