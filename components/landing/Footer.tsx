import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <p className="site-footer-wordmark">Label Workspace</p>
          <p className="site-footer-tagline">Self-serve label design for AN/SFC private-label customers.</p>
        </div>
        <div className="site-footer-contact">
          <p className="site-footer-contact-title">Contact us</p>
          <a href="mailto:hello@labelworkspace.com">hello@labelworkspace.com</a>
          <a href="tel:+94112345678">+94 11 234 5678</a>
          <p>No. 123, Industry Road, Colombo, Sri Lanka</p>
        </div>
        <nav className="site-footer-links">
          <a href="#products">Get started</a>
          <Link href="/admin/login">Staff sign-in</Link>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <p>© {new Date().getFullYear()} Label Workspace. All rights reserved.</p>
      </div>
    </footer>
  );
}
