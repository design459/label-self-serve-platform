export default function ConfigNotice({ message }: { message: string }) {
  return (
    <div className="page-narrow">
      <div className="error-box">{message}</div>
      <p className="subtitle">See the README's "Setting up Supabase" section.</p>
    </div>
  );
}
