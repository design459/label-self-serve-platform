import Link from "next/link";

export default function HomePage() {
  return (
    <div className="hero">
      <img className="hero-bg" src="/hero/packaging-hero.png" alt="" />
      <div className="hero-scrim" />
      <div className="hero-content">
        <p className="hero-eyebrow">Label generation</p>
        <h1 className="hero-heading">
          Your label workspace,
          <br />
          one click away
        </h1>
        <p className="hero-subtitle">
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
