import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Assignment, Student } from '../types';
import { leveledComment } from '../standards/leveledComments';

vi.mock('../firebase/config', () => ({ db: { __fake: true } }));
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ status: 'signedIn', user: { uid: 'u1', email: 't@x.edu' } }),
}));
vi.mock('../auth/authService', () => ({ signOutTeacher: vi.fn(() => Promise.resolve()) }));

import { AssignmentFeedbackPage } from './AssignmentFeedbackPage';

const assignment: Assignment = {
  id: 'a1',
  yearId: 'y1',
  courseId: 'co1',
  title: 'Revolution DBQ',
  standardCodes: ['SSS4.6-8.1'],
  summative: true,
  periodIds: ['p1'],
  createdAt: 1,
};

const roster: Student[] = [
  { id: 's1', name: 'Ana G.', email: 'ana@x.edu' },
  { id: 's2', name: 'Ben H.', email: 'ben@x.edu' },
];

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    resolveYearId: vi.fn(async () => 'y1'),
    getAssignment: vi.fn(async () => assignment),
    listStudents: vi.fn(async () => roster),
    writeFeedbackHistory: vi.fn(async () => 'assignment_a1__s1'),
    ...overrides,
  };
}

function renderAt(deps: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={['/course/co1/assignment/a1']}>
      <Routes>
        <Route
          path="/course/:courseId/assignment/:assignmentId"
          element={
            <AssignmentFeedbackPage
              deps={deps as Parameters<typeof AssignmentFeedbackPage>[0]['deps']}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AssignmentFeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no clipboard by default; provide a stub.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  it('renders the assignment title, its standards, and the roster for the period', async () => {
    const deps = makeDeps();
    renderAt(deps);
    expect(await screen.findByRole('heading', { name: 'Revolution DBQ' })).toBeInTheDocument();
    expect(await screen.findByText('Ana G.')).toBeInTheDocument();
    expect(screen.getByText('ana@x.edu')).toBeInTheDocument();
    expect(screen.getByText('Ben H.')).toBeInTheDocument();
    expect(deps.listStudents).toHaveBeenCalledWith({ __fake: true }, 'u1', 'y1', 'co1', 'p1');
    // Helper line for the copy-paste delivery.
    expect(screen.getByText(/copy each comment into canvas speedgrader/i)).toBeInTheDocument();
  });

  it('inserting a level drops the {name}-filled leveled comment into that student\'s textarea', async () => {
    renderAt(makeDeps());
    await screen.findByText('Ana G.');

    // There is one picker per student; click Ana's "3 Proficient" button.
    const proficientButtons = screen.getAllByRole('button', { name: '3 Proficient' });
    fireEvent.click(proficientButtons[0]);

    const comment = leveledComment('SSS4.6-8.1', 3)!;
    const expected = `${comment.text.replace('{name}', 'Ana')} ${comment.nextStep}`;
    const ta = screen.getByLabelText('Comment for Ana G.') as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value).toBe(expected));
    // Ben's textarea is untouched.
    expect((screen.getByLabelText('Comment for Ben H.') as HTMLTextAreaElement).value).toBe('');
  });

  it('Mark posted writes history with assignmentId, extraStandards, the comment text, and an idempotent batchId', async () => {
    const deps = makeDeps();
    renderAt(deps);
    await screen.findByText('Ana G.');

    fireEvent.change(screen.getByLabelText('Comment for Ana G.'), {
      target: { value: 'Great thesis, Ana.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mark posted for Ana G.' }));

    await waitFor(() => expect(deps.writeFeedbackHistory).toHaveBeenCalledTimes(1));
    const [, uidArg, args] = (deps.writeFeedbackHistory as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(uidArg).toBe('u1');
    expect(args.assignmentId).toBe('a1');
    expect(args.extraStandards).toEqual(['SSS4.6-8.1']);
    expect(args.draft.finalText).toBe('Great thesis, Ana.');
    expect(args.draft.studentId).toBe('s1');
    expect(args.draft.status).toBe('sent');
    expect(args.label).toBe('Revolution DBQ');
    expect(args.unit).toBe('Revolution DBQ');
    expect(args.tree).toEqual({ yearId: 'y1', courseId: 'co1', periodId: 'p1' });
    // Idempotent batch id shape: assignment_{id} → doc id assignment_{id}__{studentId}.
    expect(args.batchId).toBe('assignment_a1');

    // Posted state shows.
    expect(await screen.findByTestId('posted-s1')).toBeInTheDocument();
  });

  it('Copy writes the comment text to the clipboard', async () => {
    renderAt(makeDeps());
    await screen.findByText('Ana G.');
    fireEvent.change(screen.getByLabelText('Comment for Ana G.'), {
      target: { value: 'Nice work.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy comment for Ana G.' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Nice work.'),
    );
  });
});
