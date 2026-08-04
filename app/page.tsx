import Link from "next/link";

export default function HomePage() {
  return (
    <div className="page-narrow">
      <div className="card">
        <h1>Label workspace</h1>
        <p className="subtitle">
          Customers reach their label workspace via a link issued for their order — there is no general
          public entry point here.
        </p>
        <Link className="btn" href="/admin/login">
          Staff sign-in
        </Link>
      </div>
    </div>
  );
}
