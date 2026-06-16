// src/send/SendProgressPanel.tsx
import { progressOf, failedIds, type SendState } from './batchSendMachine';

// SendState shape (from batchSendMachine): { order, statuses, errors, phase }
// progressOf -> { done, total, sent, failed }; failedIds -> string[]

export interface SendProgressPanelProps {
  state: SendState;
  names: Record<string, { name: string; email: string }>;
  onRetry: (failedIds: string[]) => void;
}

export function SendProgressPanel({ state, names, onRetry }: SendProgressPanelProps) {
  const { done, total, sent, failed } = progressOf(state);
  const failures = failedIds(state);

  return (
    <section aria-label="Send progress">
      <progress
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        value={done}
        max={total}
      />
      <p>
        {done} of {total} processed — {sent} sent, {failed} failed
      </p>

      {failures.length > 0 && (
        <div aria-label="Failures to retry">
          <h3>Failed — retry only these</h3>
          <ul>
            {failures.map((id) => (
              <li key={id}>
                <strong>{names[id]?.name ?? id}</strong>{' '}
                <span>{names[id]?.email}</span>
                <em>{state.errors[id]}</em>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onRetry(failures)}>
            Retry failed ({failures.length})
          </button>
        </div>
      )}
    </section>
  );
}
