/**
 * NotificationsSection — the Account page's Notifications: this device (install Tuklas as an app,
 * turn push notifications on or off here), then per category whether updates also arrive by email
 * or as a push notification, and the weekly digest. In-app updates always arrive.
 */
import { useEffect, useState } from 'react';
import { BellOff, BellRing, Download } from 'lucide-react';
import { useNotificationSettings, usePushStatus, useSaveNotificationSettings, useSetPush } from '../../api/account';
import type { NotificationSettings } from '../../types/account';
import { currentSubscription, isAppleMobile, isInstalled, pushSupported, subscribePush, useInstallPrompt } from '../../lib/pwa';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Sheet } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import styles from './Account.module.css';

export function NotificationsSection() {
  const { data, isPending } = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const toast = useToast();

  const change = (s: NotificationSettings, patch: Partial<Pick<NotificationSettings, 'email' | 'push' | 'digest'>>) =>
    save.mutate(
      { email: { ...s.email, ...patch.email }, push: { ...s.push, ...patch.push }, digest: patch.digest ?? s.digest },
      { onError: (e) => toast(e.message, 'error') },
    );

  return (
    <Sheet title="Notifications">
      <div className={styles.form}>
        <ThisDevice />
        {isPending || !data ? (
          <Skeleton />
        ) : (
          <>
            <p className={styles.muted}>
              Every update shows in Tuklas. Choose which ones also come by email{data.emailVerified ? '' : ' (once you confirm your address)'} or as a
              notification on the devices you turned on.
            </p>
            <ul className={styles.channels}>
              {data.categories.map((c) => (
                <li key={c.key} className={styles.channel} role="group" aria-label={c.label}>
                  <span className={styles.channelText}>
                    <span className={styles.channelLabel}>{c.label}</span>
                    <span className={styles.muted}>{c.description}</span>
                  </span>
                  <span className={styles.channelSwitches}>
                    <Switch label="Email" checked={data.email[c.key] ?? false} disabled={save.isPending} onChange={(on) => change(data, { email: { [c.key]: on } })} />
                    <Switch label="Push" checked={data.push[c.key] ?? false} disabled={save.isPending} onChange={(on) => change(data, { push: { [c.key]: on } })} />
                  </span>
                </li>
              ))}
            </ul>
            <Switch
              label="Weekly digest email"
              hint="Monday morning: updates you haven’t read, this week’s deadlines and events, and new research from your department."
              checked={data.digest}
              disabled={save.isPending}
              onChange={(on) => change(data, { digest: on })}
            />
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Installing Tuklas, and push notifications for this browser or phone. */
function ThisDevice() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: status } = usePushStatus(checked ? (subscription?.endpoint ?? '') : null);
  const setPush = useSetPush();
  const { available: canInstall, install } = useInstallPrompt();
  const toast = useToast();

  useEffect(() => {
    currentSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setChecked(true));
  }, []);

  const on = Boolean(subscription && status?.thisDevice);

  const turnOn = async () => {
    if (!status) return;
    setBusy(true);
    try {
      const s = await subscribePush(status.publicKey);
      await setPush.mutateAsync({ subscription: s, on: true });
      setSubscription(s);
      toast('Notifications are on for this device.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t turn notifications on.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await setPush.mutateAsync({ subscription, on: false });
      await subscription.unsubscribe();
      setSubscription(null);
      toast('Notifications are off for this device.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t turn notifications off.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const others = (status?.devices.length ?? 0) - (on ? 1 : 0);

  return (
    <div className={styles.device}>
      <p className={styles.channelLabel}>This device</p>
      {isInstalled() ? (
        <p className={styles.muted}>Tuklas is installed here as an app.</p>
      ) : canInstall ? (
        <div className={styles.actions}>
          <Button icon={<Download size={16} aria-hidden="true" />} onClick={() => install().then((ok) => ok && toast('Tuklas is installed.', 'success'))}>
            Install Tuklas
          </Button>
          <span className={styles.muted}>Opens like an app, from your home screen or desktop.</span>
        </div>
      ) : (
        <p className={styles.muted}>
          {isAppleMobile()
            ? 'To install Tuklas, tap Share, then Add to Home Screen.'
            : 'To install Tuklas, use your browser’s menu: Install app, or Add to Home screen.'}
        </p>
      )}

      {!pushSupported() ? (
        <Notice>
          {isAppleMobile()
            ? 'On iPhone and iPad, notifications work once Tuklas is on your home screen: install it, open it from there, then turn them on here.'
            : 'This browser can’t show notifications from websites.'}
        </Notice>
      ) : status && !status.available ? (
        <p className={styles.muted}>Push notifications aren’t set up on this server yet.</p>
      ) : (
        <div className={styles.actions}>
          {on ? (
            <Button icon={<BellOff size={16} aria-hidden="true" />} loading={busy} onClick={turnOff}>
              Turn off notifications here
            </Button>
          ) : (
            <Button variant="primary" icon={<BellRing size={16} aria-hidden="true" />} loading={busy} disabled={!status} onClick={turnOn}>
              Turn on notifications here
            </Button>
          )}
          {others > 0 && (
            <span className={styles.muted}>
              Also on {others} other {others === 1 ? 'device' : 'devices'}.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
