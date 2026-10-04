import { getDb } from "../src/db.js";
import { ensureUser } from "../src/coordinator.js";
import { birdBehaviorCourse } from "./demo-data/bird-course.js";
import { demoPresentation } from "./demo-data/presentation.js";
import { demoEmails } from "./demo-data/emails.js";

const db = await getDb();
await ensureUser("demo-user", "Demo User");

await db.query(
  `INSERT INTO presentations (id,user_id,title,presentation_time,audience,duration_minutes,objective,main_thesis,opening_script,closing_script,estimated_prep_time_minutes)
   VALUES ($1,$2,$3,now()+interval '1 day',$4,$5,$6,$7,$8,$9,$10)
   ON CONFLICT (id) DO UPDATE SET user_id=$2,title=$3,presentation_time=now()+interval '1 day',audience=$4,duration_minutes=$5,
     objective=$6,main_thesis=$7,opening_script=$8,closing_script=$9,estimated_prep_time_minutes=$10,updated_at=now()`,
  [demoPresentation.id, demoPresentation.userId, demoPresentation.title, demoPresentation.audience, demoPresentation.durationMinutes,
   demoPresentation.objective, demoPresentation.mainThesis, demoPresentation.openingScript, demoPresentation.closingScript, demoPresentation.estimatedPrepTimeMinutes]);

await Promise.all(demoPresentation.slides.map((slide) =>
  db.query(
    `INSERT INTO presentation_slides (id,presentation_id,slide_number,title,purpose,key_points,speaker_notes,transition_to_next_slide,important_concepts)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)
     ON CONFLICT (id) DO UPDATE SET presentation_id=$2,slide_number=$3,title=$4,purpose=$5,key_points=$6::jsonb,
       speaker_notes=$7,transition_to_next_slide=$8,important_concepts=$9::jsonb`,
    [slide.id, demoPresentation.id, slide.slideNumber, slide.title, slide.purpose, JSON.stringify(slide.keyPoints),
     slide.speakerNotes, slide.transitionToNextSlide, JSON.stringify(slide.importantConcepts)])));
await Promise.all(demoPresentation.questions.map((question) =>
  db.query(
    `INSERT INTO presentation_questions (id,presentation_id,question,why_they_might_ask,suggested_answer,key_point_to_remember)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET presentation_id=$2,question=$3,why_they_might_ask=$4,suggested_answer=$5,key_point_to_remember=$6`,
    [question.id, demoPresentation.id, question.question, question.whyTheyMightAsk, question.suggestedAnswer, question.keyPointToRemember])));

await db.query(
  `INSERT INTO courses (id,title,description) VALUES ($1,$2,$3)
   ON CONFLICT (id) DO UPDATE SET title=$2,description=$3,updated_at=now()`,
  [birdBehaviorCourse.id, birdBehaviorCourse.title, birdBehaviorCourse.description]);

await Promise.all(birdBehaviorCourse.lectures.map((lesson, index) =>
  db.query(
    `INSERT INTO lessons (id,course_id,lesson_order,title,topic,short_description,difficulty,estimated_duration_minutes,full_lecture_script)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET course_id=$2,lesson_order=$3,title=$4,topic=$5,short_description=$6,difficulty=$7,
       estimated_duration_minutes=$8,full_lecture_script=$9,updated_at=now()`,
    [lesson.id, birdBehaviorCourse.id, index + 1, lesson.title, lesson.topic, lesson.shortDescription,
     lesson.difficulty, lesson.estimatedDurationMinutes, lesson.fullLectureScript])));
await Promise.all(birdBehaviorCourse.lectures.map((lesson) =>
  db.query("UPDATE lessons SET previous_lesson_id=$1,next_lesson_id=$2 WHERE id=$3",
    [lesson.previousLessonId ?? null, lesson.nextLessonId ?? null, lesson.id])));

await db.query(
  `INSERT INTO user_learning_progress (user_id,course_id,current_lesson_id,completed_lessons)
   VALUES ('demo-user',$1,'bird-02-magnetic-navigation',$2::jsonb)
   ON CONFLICT (user_id,course_id) DO UPDATE SET current_lesson_id='bird-02-magnetic-navigation',completed_lessons=$2::jsonb,updated_at=now()`,
  [birdBehaviorCourse.id, JSON.stringify(["bird-01-migration"])]);

await Promise.all(demoEmails.map((email) => db.query(
  `INSERT INTO demo_emails (id,user_id,thread_id,sender_name,sender_email,subject,received_at,body,short_summary,importance,urgency,category,
     requires_response,suggested_action,response_deadline,related_meeting_id,related_presentation_id,is_read,is_archived)
   VALUES ($1,'demo-user',$2,$3,$4,$5,now()-($6*interval '1 hour'),$7,$8,$9,$10,$11,$12,$13,
     CASE WHEN $14::double precision IS NULL THEN NULL ELSE now()+($14*interval '1 hour') END,$15,$16,$17,$18)
   ON CONFLICT (id) DO UPDATE SET thread_id=$2,sender_name=$3,sender_email=$4,subject=$5,received_at=now()-($6*interval '1 hour'),
     body=$7,short_summary=$8,importance=$9,urgency=$10,category=$11,requires_response=$12,suggested_action=$13,
     response_deadline=CASE WHEN $14::double precision IS NULL THEN NULL ELSE now()+($14*interval '1 hour') END,
     related_meeting_id=$15,related_presentation_id=$16,is_read=$17,is_archived=$18,updated_at=now()`,
  [email.id, email.threadId, email.senderName, email.senderEmail, email.subject, email.receivedHoursAgo, email.body, email.shortSummary,
   email.importance, email.urgency, email.category, email.requiresResponse, email.suggestedAction, email.deadlineHoursFromNow,
   email.relatedMeetingId, email.relatedPresentationId, email.isRead, email.isArchived])));

const [[presentationCount], [slideCount], [questionCount], [courseCount], [lessonCount], [emailCount]] = await Promise.all([
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM presentations WHERE id=$1", [demoPresentation.id]),
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM presentation_slides WHERE presentation_id=$1", [demoPresentation.id]),
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM presentation_questions WHERE presentation_id=$1", [demoPresentation.id]),
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM courses WHERE id=$1", [birdBehaviorCourse.id]),
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM lessons WHERE course_id=$1", [birdBehaviorCourse.id]),
  db.query<{ count: number }>("SELECT count(*)::int AS count FROM demo_emails WHERE user_id='demo-user' AND id LIKE 'demo-email-%'"),
]);
console.log(`Seeded ${db.kind}: ${presentationCount.count} presentation, ${slideCount.count} slides, ${questionCount.count} questions, ${courseCount.count} course, ${lessonCount.count} lessons, ${emailCount.count} emails.`);
process.exit(0);
