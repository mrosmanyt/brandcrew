export type GeneratedArtifact = {
  type: string;
  title: string;
  summary: string;
  content: string;
  calendar?: {
    date: string;
    channel: string;
    title: string;
    content: string;
  }[];
  tasks?: { title: string; description: string; status: string }[];
};
