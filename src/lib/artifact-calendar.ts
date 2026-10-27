import { addDays, format } from "date-fns";

export type CalendarSeed = {
  date: string;
  channel: string;
  title: string;
  content: string;
  artifactId?: string;
};

export function extractMarkdownSections(content: string) {
  const chunks = content.split(/^##\s+/m).slice(1);
  return chunks
    .map((chunk) => {
      const [titleLine, ...rest] = chunk.split("\n");
      return {
        title: (titleLine || "").trim(),
        body: rest.join("\n").trim(),
      };
    })
    .filter((section) => section.title.length > 0);
}

export function calendarItemsFromApprovedArtifact(input: {
  artifactId: string;
  agentRole: string;
  title: string;
  content: string;
}): CalendarSeed[] {
  const sections = extractMarkdownSections(input.content);
  const usable = sections.filter((section) => {
    const title = section.title.toLowerCase();
    if (title.includes("what not") || title.includes("ideal customer")) return false;
    if (title.includes("offer") || title.includes("pillar")) return false;
    return section.body.length > 20;
  });

  const start = addDays(new Date(), 1);
  const picks = usable.slice(0, 7);
  if (!picks.length) {
    return [
      {
        date: format(start, "yyyy-MM-dd"),
        channel: input.agentRole === "sales" ? "email" : "linkedin",
        title: input.title,
        content: input.content.slice(0, 400),
        artifactId: input.artifactId,
      },
    ];
  }

  return picks.map((section, index) => {
    const title = section.title.toLowerCase();
    const channel =
      title.includes("email") || title.includes("newsletter")
        ? "email"
        : "linkedin";
    return {
      date: format(addDays(start, index), "yyyy-MM-dd"),
      channel,
      title: section.title,
      content: section.body.slice(0, 500),
      artifactId: input.artifactId,
    };
  });
}
