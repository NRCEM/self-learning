import type { Lesson } from './lesson-schema.ts';
export type LessonEntry = { status: 'loading' | 'ready' | 'error'; lesson?: Lesson; error?: string; answers: Record<string, number>; submitted: boolean };

// In-memory session, keyed by topic. Changing document invalidates every pending result.
export class LessonSession {
  private snapshot = new Map<string, LessonEntry>();
  private listeners = new Set<() => void>();
  private pending = new Map<string, Promise<void>>();
  private controllers = new Map<string, AbortController>();
  private version = 0;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  private put(id: string, value: LessonEntry) { this.snapshot = new Map(this.snapshot).set(id, value); this.emit(); }
  clear() {
    this.version++; this.controllers.forEach(c => c.abort()); this.controllers.clear(); this.pending.clear();
    this.snapshot = new Map(); this.emit();
  }
  load(id: string, generate: (signal: AbortSignal) => Promise<Lesson>): Promise<void> {
    if (this.snapshot.get(id)?.lesson) return Promise.resolve();
    const existing = this.pending.get(id); if (existing) return existing;
    const version = this.version; const controller = new AbortController(); this.controllers.set(id, controller);
    this.put(id, { status: 'loading', answers: {}, submitted: false });
    const task = Promise.resolve().then(() => generate(controller.signal)).then(lesson => {
      if (version !== this.version) return;
      if (lesson.topicId !== id) throw new Error('Lesson topic does not match the request. Try again.');
      this.put(id, { status: 'ready', lesson, answers: {}, submitted: false });
    }).catch(error => {
      if (version === this.version) this.put(id, { status: 'error', error: error instanceof Error ? error.message : 'Unable to load the lesson. Try again.', answers: {}, submitted: false });
    }).finally(() => { if (version === this.version) { this.pending.delete(id); this.controllers.delete(id); } });
    this.pending.set(id, task); return task;
  }
  answer(id: string, questionId: string, choice: number) {
    const entry = this.snapshot.get(id);
    if (!entry?.lesson || entry.submitted || !Number.isInteger(choice) || choice < 0 || choice > 3 || !entry.lesson.quiz.some(q => q.id === questionId)) return;
    this.put(id, { ...entry, answers: { ...entry.answers, [questionId]: choice } });
  }
  submit(id: string) {
    const entry = this.snapshot.get(id);
    if (entry?.lesson && entry.lesson.quiz.every(q => Number.isInteger(entry.answers[q.id]))) this.put(id, { ...entry, submitted: true });
  }
  resetQuiz(id: string) { const entry = this.snapshot.get(id); if (entry?.lesson) this.put(id, { ...entry, answers: {}, submitted: false }); }
}
