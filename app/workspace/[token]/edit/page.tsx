import EditorPage from "@/components/workspace/EditorPage";

export default function WorkspaceEditPage({ params }: { params: { token: string } }) {
  return <EditorPage token={params.token} />;
}
