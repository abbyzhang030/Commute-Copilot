import { getCourseWithLessons, getLearningProgress, getNextLessonForUser, markLessonComplete, type LessonRecord } from "../content-repository.js";

export const BIRD_COURSE_ID = "bird-behavior-neuroscience";

export async function getLearnerProgress(userId: string) {
  return getLearningProgress(userId, BIRD_COURSE_ID);
}

export async function selectLecture(userId: string, availableMinutes: number, excludeLessonIds: string[] = []): Promise<LessonRecord | null> {
  return getNextLessonForUser(userId, BIRD_COURSE_ID, availableMinutes, excludeLessonIds);
}

export async function completeLecture(userId: string, lessonId: string) {
  return markLessonComplete(userId, BIRD_COURSE_ID, lessonId);
}

export async function getCourseCatalog() {
  const course = await getCourseWithLessons(BIRD_COURSE_ID);
  return course ? { ...course, lectures: course.lessons } : null;
}
