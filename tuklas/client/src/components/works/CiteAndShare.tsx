/**
 * CiteAndShare — the citation, QR code and reaction blocks on a work's page.
 * Exports CitationBox, QrBox and Reactions.
 */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Lightbulb, Sparkles, Wrench } from 'lucide-react';
import type { ReactionKind, WorkDetail } from '../../types/works';
import { useReact } from '../../api/works';
import { apa, mla, type Citation, type CiteSource } from '../../lib/citation';
import { reactionLabel } from '../../lib/labels';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import styles from './CiteAndShare.module.css';

/** One-click citation in APA 7 or MLA 9, for a student work or an educator's research. */
export function CitationBox({ source, title = 'Cite this work' }: { source: CiteSource; title?: string }) {
  const [style, setStyle] = useState<'apa' | 'mla'>('apa');
  const toast = useToast();
  const cite: Citation = style === 'apa' ? apa(source) : mla(source);
  const copy = () =>
    (navigator.clipboard?.writeText(cite.plain) ?? Promise.reject()).then(
      () => toast(`${style === 'apa' ? 'APA' : 'MLA'} citation copied.`, 'success'),
      () => toast('Copy didn’t work. Select the citation and copy it by hand.', 'error'),
    );

  return (
    <Sheet title={title}>
      <div className={styles.cite}>
        <Segmented
          label="Citation style"
          value={style}
          onChange={setStyle}
          options={[
            { value: 'apa', label: 'APA 7' },
            { value: 'mla', label: 'MLA 9' },
          ]}
        />
        <p className={styles.citation}>
          {cite.parts.map((p, i) => (p.italic ? <i key={i}>{p.text}</i> : <span key={i}>{p.text}</span>))}
        </p>
        <Button icon={<Copy size={16} aria-hidden="true" />} onClick={copy} block>
          Copy citation
        </Button>
      </div>
    </Sheet>
  );
}

/** A QR code for research-fair posters, pointing at the public work page. */
export function QrBox({ work }: { work: WorkDetail }) {
  const [src, setSrc] = useState<string | null>(null);
  const url = `${window.location.origin}/works/${work.id}`;

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#222221', light: '#ffffff' } })
      .then((data) => live && setSrc(data))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [url]);

  return (
    <Sheet title="QR code for posters">
      <div className={styles.qr}>
        {src ? <img src={src} alt={`QR code linking to ${work.title}`} className={styles.qrImage} /> : <span className={styles.qrImage} />}
        <p className={styles.qrNote}>
          Scans open this work’s page on Tuklas.
        </p>
        {src && (
          <a href={src} download={`tuklas-work-${work.id}.png`} className={styles.download}>
            <Download size={16} aria-hidden="true" />
            Download PNG
          </a>
        )}
      </div>
    </Sheet>
  );
}

const reactionIcon: Record<ReactionKind, typeof Lightbulb> = { insightful: Lightbulb, useful: Wrench, inspiring: Sparkles };

/** Reactions: one per reader, academic in tone. */
export function Reactions({ work, canReact }: { work: WorkDetail; canReact: boolean }) {
  const react = useReact();
  const toast = useToast();
  return (
    <div className={styles.reactions} role="group" aria-label="Reactions" id="reactions">
      {(Object.keys(reactionLabel) as ReactionKind[]).map((k) => {
        const Icon = reactionIcon[k];
        const mine = work.myReaction === k;
        return (
          <button
            key={k}
            type="button"
            className={styles.reaction}
            aria-pressed={mine}
            disabled={!canReact || react.isPending}
            onClick={() => react.mutate({ id: work.id, kind: mine ? null : k }, { onError: (e) => toast(e.message, 'error') })}
          >
            <Icon size={16} aria-hidden="true" />
            {reactionLabel[k]}
            <span className={styles.count}>{work.reactions[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
