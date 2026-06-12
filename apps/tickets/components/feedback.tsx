import Link from 'next/link';

export function LoadingEvents() {
  return (
    <div aria-label="Loading events" aria-live="polite" className="event-list">
      {[0, 1, 2].map((item) => <div className="event-skeleton" key={item}><span /><span /><span /></div>)}
    </div>
  );
}

export function InlineError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="inline-alert inline-alert-error" role="alert">
      <div><strong>Connection failed</strong><p>{message}</p></div>
      {retry ? <button className="text-button" onClick={retry} type="button">Try again</button> : null}
    </div>
  );
}

export function EmptyTickets() {
  return (
    <div className="empty-state">
      <div className="empty-mark" aria-hidden="true" />
      <h2>No tickets yet</h2>
      <p>Claim a free place from a listed event. Your ticket will stay available after you sign in on another device.</p>
      <Link className="button button-primary" href="/">Browse events</Link>
    </div>
  );
}
