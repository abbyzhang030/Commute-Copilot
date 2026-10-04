import { getCourseWithLessons, getNextLessonForUser, getUpcomingPresentation } from "../src/content-repository.js";
import { getInboxBriefing } from "../src/integrations/email-agent.js";

const presentation = await getUpcomingPresentation("demo-user");
const course = await getCourseWithLessons("bird-behavior-neuroscience");
const fittingLesson = await getNextLessonForUser("demo-user", "bird-behavior-neuroscience", 10);
const emailBriefing = await getInboxBriefing("demo-user", 3);

if (!presentation || presentation.slides.length < 6 || presentation.questions.length < 8) throw new Error("BCI presentation seed is incomplete");
if (!course || course.lessons.length < 8 || !fittingLesson?.fullLectureScript) throw new Error("Bird course seed is incomplete");
if (emailBriefing.emails.length < 2) throw new Error("Demo email seed is incomplete");

console.log(JSON.stringify({
  presentation: { title: presentation.title, slides: presentation.slides.length, questions: presentation.questions.length },
  course: { title: course.title, lessons: course.lessons.length },
  fittingLesson: { title: fittingLesson.title, minutes: fittingLesson.estimatedDurationMinutes, scriptCharacters: fittingLesson.fullLectureScript.length },
  urgentEmails: emailBriefing.emails.map((email) => ({ sender: email.senderName, subject: email.subject, score: email.rankScore })),
}, null, 2));
process.exit(0);
