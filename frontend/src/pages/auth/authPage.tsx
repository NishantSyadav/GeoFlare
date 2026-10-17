import { Link, useLocation, useNavigate } from "react-router-dom";
import InteractiveGlobe2 from "../../components/globe/interactiveGlobe2";
import AuthForm from "../../components/auth/authForm";
import "./authPage.css";


export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isSignUp = location.pathname === "/signup";
  const switchMode = () => navigate(isSignUp ? "/login" : "/signup");
  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="GeoFlare environmental intelligence">
        <Link to="/" className="auth-brand"><span>Geo</span>Flare</Link>
        <div className="auth-globe"><InteractiveGlobe2 width={620} height={620} showGlow={false} /></div>
        <div className="auth-visual-copy"><h2>Understand the world in motion.</h2><p>Explore environmental patterns and connect the signals that shape our planet.</p></div>
      </section>
      <section className="auth-panel">
        <p className="auth-top-switch">{isSignUp ? "Already a member?" : "New here?"} <button onClick={switchMode}>{isSignUp ? "Sign in" : "Create account"}</button></p>
        <div className={`auth-viewport ${isSignUp ? "is-signup" : ""}`}>
          <div className="auth-track">
            <div className="auth-slide"><AuthForm mode="signin" onSwitch={switchMode} /></div>
            <div className="auth-slide"><AuthForm mode="signup" onSwitch={switchMode} /></div>
          </div>
        </div>
        <footer>© {new Date().getFullYear()} GeoFlare</footer>
      </section>
    </main>
  );
}
