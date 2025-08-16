export type QuestionKind = 'single'|'multi'|'free'|'scale';
export type Question = { id: string; kind: QuestionKind; label: string; options?: string[]; required?: boolean };
export type Campaign = { id: string; name: string; startsAt: string; endsAt?: string; questions: Question[] };
