import WorkspaceApp from "@/components/workspace/WorkspaceApp";

export default function WorkspacePage({ params }: { params: { token: string } }) {
  return <WorkspaceApp token={params.token} />;
}
