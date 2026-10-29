/**
 * Tuko — the Tuklas mascot drawn as an inline SVG, in idle or cheer pose.
 * Used in empty states and success moments.
 */
import clsx from 'clsx';
import styles from './Tuko.module.css';

export type TukoPose = 'idle' | 'cheer';

interface TukoProps {
  pose?: TukoPose;
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when Tuko carries meaning on its own. */
  label?: string;
}

const INK = '#222221';
const SKIN = '#53C0E8';
const SKIN_DEEP = '#2B97C2';
const BELLY = '#C6EEFB';
const GOLD = '#FFCB57';
const GOLD_DEEP = '#E2A93A';
const PURPLE = '#6C4AB6';

/** Tuko: the Tuklas gecko in a gold graduation cap. Empty states and success moments. */
export function Tuko({ pose = 'idle', size = 96, className, label }: TukoProps) {
  const cheer = pose === 'cheer';
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={clsx(styles.tuko, cheer ? styles.cheer : styles.idle, className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className={styles.tail}>
        <path d="M76 98c20 3 30-10 23-21-4-7-12-5-10 2" fill="none" stroke={INK} strokeWidth="12" strokeLinecap="round" />
        <path d="M76 98c20 3 30-10 23-21-4-7-12-5-10 2" fill="none" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
      </g>

      <g className={styles.body}>
        {/* legs */}
        <Limb d="M48 96 L38 106" toes={[34, 108]} />
        <Limb d="M72 96 L82 106" toes={[86, 108]} />
        {/* arms */}
        {cheer ? (
          <>
            <Limb d="M44 72 L28 54" toes={[25, 50]} />
            <Limb d="M76 72 L92 54" toes={[95, 50]} />
          </>
        ) : (
          <>
            <Limb d="M43 78 L34 92" toes={[31, 95]} />
            <Limb d="M77 78 L86 92" toes={[89, 95]} />
          </>
        )}
        <ellipse cx="60" cy="84" rx="22" ry="22" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <ellipse cx="60" cy="88" rx="13" ry="14" fill={BELLY} />
        <circle cx="45" cy="80" r="2.6" fill={SKIN_DEEP} />
        <circle cx="76" cy="86" r="2.2" fill={SKIN_DEEP} />
        <circle cx="73" cy="75" r="1.8" fill={SKIN_DEEP} />

        {/* head */}
        <ellipse cx="60" cy="52" rx="29" ry="22" fill={SKIN} stroke={INK} strokeWidth="2.5" />
        <circle cx="60" cy="38" r="2.4" fill={SKIN_DEEP} />
        <circle cx="68" cy="40" r="1.8" fill={SKIN_DEEP} />
        <circle cx="38" cy="58" r="4" fill={PURPLE} opacity="0.22" />
        <circle cx="82" cy="58" r="4" fill={PURPLE} opacity="0.22" />
        {cheer ? (
          <>
            <path d="M40 51q6-8 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M68 51q6-8 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
            <path d="M50 59q10 11 20 0z" fill={INK} />
          </>
        ) : (
          <>
            <Eye cx={46} />
            <Eye cx={74} />
            <path d="M52 61q8 6 16 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* gold graduation cap */}
        <g className={styles.cap} transform="translate(0 -7)">
          <path d="M44 33v8q16 9 32 0v-8" fill={GOLD_DEEP} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M28 30 60 17l32 13-32 13z" fill={GOLD} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <g className={styles.tassel}>
            <path d="M60 30l25 4v13" fill="none" stroke={PURPLE} strokeWidth="2.5" strokeLinecap="round" />
            <rect x="82" y="46" width="6" height="8" rx="2" fill={PURPLE} />
          </g>
          <circle cx="60" cy="30" r="3" fill={PURPLE} />
        </g>
      </g>

      {cheer && (
        <g className={styles.sparks} fill={GOLD} stroke={INK} strokeWidth="1.5" strokeLinejoin="round">
          <path d="M16 30l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
          <path d="M104 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
          <path d="M108 60l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        </g>
      )}
    </svg>
  );
}

// ---------- SVG parts ----------

function Limb({ d, toes: [x, y] }: { d: string; toes: [number, number] }) {
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <path d={d} stroke={SKIN} strokeWidth="6" strokeLinecap="round" />
      <g fill={SKIN} stroke={INK} strokeWidth="1.8">
        <circle cx={x - 4} cy={y} r="3.2" />
        <circle cx={x} cy={y + 2} r="3.2" />
        <circle cx={x + 4} cy={y} r="3.2" />
      </g>
    </g>
  );
}

function Eye({ cx }: { cx: number }) {
  return (
    <g className={styles.eye}>
      <circle cx={cx} cy="49" r="8.5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
      <ellipse cx={cx} cy="49" rx="1.9" ry="6" fill={INK} />
      <circle cx={cx + 3} cy="45.5" r="1.8" fill="#ffffff" />
    </g>
  );
}
