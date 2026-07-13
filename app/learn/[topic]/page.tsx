import { LearnView } from "@/components/LearnView";

export default async function LearnTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  return <LearnView topic={decodeURIComponent(topic)} />;
}
