
import InteractiveGlobe2 from "../components/globe/interactiveGlobe2";
import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
   <section className="grid min-h-[85vh] items-center gap-8 bg-[#0d0a09] px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.2fr_0.8fr] lg:px-16">
  <div className="relative flex items-center justify-center lg:justify-start">
    <div className="w-full max-w-150">
      <InteractiveGlobe2 className="relative z-10" width={600} height={600} />
    </div>
  </div>

  <div className="max-w-xl text-left">
    <p className="mb-4 text-sm uppercase tracking-[0.3em] text-orange-400">
      Global Fire Intelligence
    </p>

    <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl md:text-6xl">
      See the fire.
      <span className="block text-orange-400">Before it spreads.</span>
    </h1>

    <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
      Monitor fire incidents, explore hotspots, and bring critical
      information together in one place.
    </p>

    <div className="mt-8 flex flex-wrap gap-4">
      <Link
        to="/signup"
        className="rounded-lg bg-orange-500 px-6 py-3 font-medium text-white transition hover:bg-orange-400"
      >
        Get started
      </Link>

      <Link
        to="/login"
        className="rounded-lg border border-white/20 px-6 py-3 text-white transition hover:border-orange-400"
      >
        Log in
      </Link>
    </div>
  </div>
</section>  );
}
