/**
 * Native notification for something that needs attention while Swasthya is in the background (an
 * incoming call). Uses the standard Notification API, so it is an OS notification in the desktop app
 * with no extra bridge. In a normal browser it only shows if the user already allowed notifications;
 * the desktop app asks, because there the permission is granted by the shell.
 */
export function notifyIfBackground(opts: { title: string; body: string; tag: string; onClick?: () => void }): Notification | null {
  if (typeof window === "undefined" || typeof Notification === "undefined") return null;
  if (document.hasFocus() && !document.hidden) return null;

  const show = () => {
    const n = new Notification(opts.title, { body: opts.body, tag: opts.tag, requireInteraction: true });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    return n;
  };

  if (Notification.permission === "granted") return show();
  if (Notification.permission === "default" && window.SwasthyaDesktop?.isDesktop) {
    void Notification.requestPermission();
  }
  return null;
}
