import { getDb } from "./db.js";

export interface PresentationSlide {
  id: string; presentationId: string; slideNumber: number; title: string; purpose: string;
  keyPoints: string[]; speakerNotes: string; transitionToNextSlide: string; importantConcepts: string[];
}
export interface PresentationQuestion {
  id: string; presentationId: string; question: string; whyTheyMightAsk: string;
  suggestedAnswer: string; keyPointToRemember: string;
}
export interface Presentation {
  id: string; userId: string | null; title: string; presentationTime: string | null; audience: string;
  durationMinutes: number; objective: string; mainThesis: string; openingScript: string;
  closingScript: string; estimatedPrepTimeMinutes: number; slides: PresentationSlide[]; questions: PresentationQuestion[];
}
export interface CourseRecord { id: string; title: string; description: string }
export interface LessonRecord {
  id: string; courseId: string; lessonOrder: number; title: string; topic: string; shortDescription: string;
  difficulty: string; estimatedDurationMinutes: number; fullLectureScript: string;
  previousLessonId?: string; nextLessonId?: string;
}
export interface LearningProgress { userId: string; courseId: string; currentLessonId: string | null; completedLessons: string[] }
export interface DemoEmail {
  id: string; userId: string; threadId: string | null; senderName: string; senderEmail: string; subject: string;
  receivedAt: string; body: string; shortSummary: string; importance: number; urgency: number; category: string;
  requiresResponse: boolean; suggestedAction: string; responseDeadline: string | null; relatedMeetingId: string | null;
  relatedPresentationId: string | null; isRead: boolean; isArchived: boolean; rankScore?: number;
}

const presentationFromRow = (row: any): Omit<Presentation, "slides" | "questions"> => ({
  id: row.id, userId: row.user_id, title: row.title, presentationTime: row.presentation_time?.toISOString?.() ?? row.presentation_time ?? null,
  audience: row.audience, durationMinutes: row.duration_minutes, objective: row.objective, mainThesis: row.main_thesis,
  openingScript: row.opening_script, closingScript: row.closing_script, estimatedPrepTimeMinutes: row.estimated_prep_time_minutes,
});
const slideFromRow = (row: any): PresentationSlide => ({ id: row.id, presentationId: row.presentation_id, slideNumber: row.slide_number,
  title: row.title, purpose: row.purpose, keyPoints: row.key_points ?? [], speakerNotes: row.speaker_notes,
  transitionToNextSlide: row.transition_to_next_slide, importantConcepts: row.important_concepts ?? [] });
const questionFromRow = (row: any): PresentationQuestion => ({ id: row.id, presentationId: row.presentation_id,
  question: row.question, whyTheyMightAsk: row.why_they_might_ask, suggestedAnswer: row.suggested_answer,
  keyPointToRemember: row.key_point_to_remember });
const lessonFromRow = (row: any): LessonRecord => ({ id: row.id, courseId: row.course_id, lessonOrder: row.lesson_order,
  title: row.title, topic: row.topic, shortDescription: row.short_description, difficulty: row.difficulty,
  estimatedDurationMinutes: row.estimated_duration_minutes, fullLectureScript: row.full_lecture_script,
  previousLessonId: row.previous_lesson_id ?? undefined, nextLessonId: row.next_lesson_id ?? undefined });
const emailFromRow = (row: any): DemoEmail => ({ id: row.id, userId: row.user_id, threadId: row.thread_id,
  senderName: row.sender_name, senderEmail: row.sender_email, subject: row.subject,
  receivedAt: row.received_at?.toISOString?.() ?? row.received_at, body: row.body, shortSummary: row.short_summary,
  importance: row.importance, urgency: row.urgency, category: row.category, requiresResponse: row.requires_response,
  suggestedAction: row.suggested_action, responseDeadline: row.response_deadline?.toISOString?.() ?? row.response_deadline ?? null,
  relatedMeetingId: row.related_meeting_id, relatedPresentationId: row.related_presentation_id,
  isRead: row.is_read, isArchived: row.is_archived, rankScore: row.rank_score === undefined ? undefined : Number(row.rank_score) });

const rankedEmailSql = `SELECT *,
  (urgency * 3 + importance * 2 + CASE WHEN requires_response THEN 8 ELSE 0 END
   + CASE WHEN response_deadline IS NOT NULL AND response_deadline <= now()+interval '6 hours' THEN 8 ELSE 0 END
   + CASE WHEN related_presentation_id IS NOT NULL OR related_meeting_id IS NOT NULL THEN 5 ELSE 0 END
   + CASE WHEN received_at >= now()-interval '6 hours' THEN 3 ELSE 0 END) AS rank_score
  FROM demo_emails WHERE user_id=$1 AND is_archived=false`;

export async function getUrgentEmails(userId: string): Promise<DemoEmail[]> {
  return (await (await getDb()).query<any>(`${rankedEmailSql} AND urgency >= 8 ORDER BY rank_score DESC, received_at DESC`, [userId])).map(emailFromRow);
}
export async function getImportantEmails(userId: string): Promise<DemoEmail[]> {
  return (await (await getDb()).query<any>(`${rankedEmailSql} AND (importance >= 7 OR urgency >= 7 OR requires_response=true) ORDER BY rank_score DESC, received_at DESC`, [userId])).map(emailFromRow);
}
export async function getEmailsRequiringResponse(userId: string): Promise<DemoEmail[]> {
  return (await (await getDb()).query<any>(`${rankedEmailSql} AND requires_response=true ORDER BY rank_score DESC, response_deadline NULLS LAST`, [userId])).map(emailFromRow);
}
export async function getRecentEmails(userId: string, limit = 10): Promise<DemoEmail[]> {
  return (await (await getDb()).query<any>(`${rankedEmailSql} ORDER BY received_at DESC LIMIT $2`, [userId, limit])).map(emailFromRow);
}
export async function getEmailsRelatedToPresentation(userId: string): Promise<DemoEmail[]> {
  return (await (await getDb()).query<any>(`${rankedEmailSql} AND related_presentation_id IS NOT NULL ORDER BY rank_score DESC`, [userId])).map(emailFromRow);
}
export async function getEmailById(userId: string, emailId: string): Promise<DemoEmail | null> {
  const [row] = await (await getDb()).query<any>(`${rankedEmailSql} AND id=$2`, [userId, emailId]);
  return row ? emailFromRow(row) : null;
}

export async function getUpcomingPresentation(userId: string): Promise<Presentation | null> {
  const db = await getDb();
  const [row] = await db.query<any>(
    "SELECT * FROM presentations WHERE user_id=$1 OR user_id IS NULL ORDER BY CASE WHEN presentation_time >= now() THEN 0 ELSE 1 END, presentation_time NULLS LAST LIMIT 1",
    [userId]);
  if (!row) return null;
  const [slides, questions] = await Promise.all([
    db.query<any>("SELECT * FROM presentation_slides WHERE presentation_id=$1 ORDER BY slide_number", [row.id]),
    db.query<any>("SELECT * FROM presentation_questions WHERE presentation_id=$1 ORDER BY id", [row.id]),
  ]);
  return { ...presentationFromRow(row), slides: slides.map(slideFromRow), questions: questions.map(questionFromRow) };
}

export async function listCourses(): Promise<CourseRecord[]> {
  return (await (await getDb()).query<any>("SELECT id,title,description FROM courses ORDER BY title"))
    .map((row) => ({ id: row.id, title: row.title, description: row.description }));
}

export async function getCourseWithLessons(courseId: string): Promise<(CourseRecord & { lessons: LessonRecord[] }) | null> {
  const db = await getDb();
  const [course] = await db.query<any>("SELECT id,title,description FROM courses WHERE id=$1", [courseId]);
  if (!course) return null;
  const lessons = await db.query<any>("SELECT * FROM lessons WHERE course_id=$1 ORDER BY lesson_order", [courseId]);
  return { id: course.id, title: course.title, description: course.description, lessons: lessons.map(lessonFromRow) };
}

export async function getLearningProgress(userId: string, courseId: string): Promise<LearningProgress | null> {
  const [row] = await (await getDb()).query<any>("SELECT * FROM user_learning_progress WHERE user_id=$1 AND course_id=$2", [userId, courseId]);
  return row ? { userId: row.user_id, courseId: row.course_id, currentLessonId: row.current_lesson_id, completedLessons: row.completed_lessons ?? [] } : null;
}

export async function findLessonsThatFit(courseId: string, availableMinutes: number, excluded: string[] = []): Promise<LessonRecord[]> {
  const rows = await (await getDb()).query<any>(
    "SELECT * FROM lessons WHERE course_id=$1 AND estimated_duration_minutes <= $2 AND NOT (id = ANY($3::text[])) ORDER BY estimated_duration_minutes DESC, lesson_order",
    [courseId, Math.floor(availableMinutes), excluded]);
  return rows.map(lessonFromRow);
}

export async function getNextLessonForUser(userId: string, courseId: string, availableMinutes: number, excluded: string[] = []): Promise<LessonRecord | null> {
  const db = await getDb();
  const progress = await getLearningProgress(userId, courseId);
  if (progress?.currentLessonId && !excluded.includes(progress.currentLessonId)) {
    const [preferred] = await db.query<any>("SELECT * FROM lessons WHERE id=$1 AND estimated_duration_minutes <= $2", [progress.currentLessonId, Math.floor(availableMinutes)]);
    if (preferred) return lessonFromRow(preferred);
  }
  const completed = progress?.completedLessons ?? [];
  const fits = await findLessonsThatFit(courseId, availableMinutes, [...completed, ...excluded]);
  return fits[0] ?? null;
}

export async function markLessonComplete(userId: string, courseId: string, lessonId: string): Promise<LearningProgress> {
  const db = await getDb();
  const [lesson] = await db.query<any>("SELECT next_lesson_id FROM lessons WHERE id=$1 AND course_id=$2", [lessonId, courseId]);
  await db.query(
    `INSERT INTO user_learning_progress (user_id,course_id,current_lesson_id,completed_lessons)
     VALUES ($1,$2,$3,jsonb_build_array($4::text))
     ON CONFLICT (user_id,course_id) DO UPDATE SET
       current_lesson_id=COALESCE($3,user_learning_progress.current_lesson_id),
       completed_lessons=CASE WHEN user_learning_progress.completed_lessons ? $4 THEN user_learning_progress.completed_lessons ELSE user_learning_progress.completed_lessons || jsonb_build_array($4::text) END,
       updated_at=now()`,
    [userId, courseId, lesson?.next_lesson_id ?? null, lessonId]);
  return (await getLearningProgress(userId, courseId))!;
}
