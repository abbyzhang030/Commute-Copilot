// Mocked integrations. Swap these for real Gmail / Calendar / Maps / Spotify / course-content calls.
export interface EmailItem { from: string; subject: string; urgency: number; summary: string }

export async function getImportantEmails(_userId: string): Promise<EmailItem[]> {
  return [
    { from: "Teammate", subject: "Notes from standup", urgency: 4, summary: "Standup notes posted; nothing blocking." },
    { from: "Campus Bookstore", subject: "20% off this weekend", urgency: 1, summary: "Promotional." },
    { from: "Manager", subject: "Agenda for today", urgency: 5, summary: "Agenda for the afternoon sync attached." },
  ];
}

export async function getCalendarContext(_userId: string) {
  return { nextEvent: { title: "Project presentation", startsAfterArrivalMinutes: 5, importance: 10 } };
}

export async function getRouteContext(_userId: string, destination?: string) {
  return { destination: destination ?? "Work", trafficLevel: "moderate", etaDriftMinutes: 0 };
}

export async function getLectureContext(_userId: string) {
  return {
    course: "Introduction to Bird Behavior and Neuroscience",
    nextLecture: "Magnetic Navigation in Migratory Birds",
    transcriptMinutes: 8,
    due: "Friday",
  };
}
