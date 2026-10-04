import { getUpcomingPresentation, type Presentation } from "../content-repository.js";

export async function getPresentationPrep(userId: string): Promise<(Presentation & { fullPrepScript: string }) | null> {
  const presentation = await getUpcomingPresentation(userId);
  if (!presentation) return null;
  const slidePractice = presentation.slides.map((slide) =>
    `Slide ${slide.slideNumber}, ${slide.title}. ${slide.speakerNotes} ${slide.transitionToNextSlide}`).join("\n\n");
  const questionPractice = presentation.questions.map((item, index) =>
    `Practice question ${index + 1}: ${item.question} Suggested answer: ${item.suggestedAnswer} Remember: ${item.keyPointToRemember}`).join("\n\n");
  return {
    ...presentation,
    fullPrepScript: `Let's prepare your presentation, ${presentation.title}. Your main thesis is: ${presentation.mainThesis}\n\nOpening: ${presentation.openingScript}\n\n${slidePractice}\n\nNow let's rehearse likely questions.\n\n${questionPractice}\n\nClosing: ${presentation.closingScript}`,
  };
}
