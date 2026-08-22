import Link from "next/link";
import ProductPicker from "@/components/landing/ProductPicker";

export default function HomePage() {
  return (
    <>
      <div className="hero" style={{ minHeight: "70vh" }}>
        <img className="hero-bg" src="/hero/packaging-hero.png" alt="" />
        <div className="hero-scrim" />
        <nav className="corner-nav">
          <Link className="btn btn-outline" href="/admin/login">
            Staff sign-in
          </Link>
        </nav>
        <div className="hero-content">
          <p className="hero-eyebrow">Label generation</p>
          <h1 className="hero-heading">
            Design your own label,
            <br />
            in minutes
          </h1>
          <p className="hero-subtitle">
            Pick your product, customize the look, and we&apos;ll handle the compliance check before it&apos;s
            print-ready.
          </p>
        </div>
      </div>
      <ProductPicker />
    </>
  );
}
