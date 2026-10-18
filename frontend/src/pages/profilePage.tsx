import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import AppLayout from "../components/layout/appLayout";

export default function ProfilePage() {
  return <AppLayout><div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.18em] text-orange-400">Account</p>
    <h1 className="mt-2 text-3xl font-semibold">Your profile</h1>
    <p className="mt-2 text-sm leading-6 text-slate-400">Your account and workspace information.</p>
    <section className="mt-6 rounded-xl border border-white/10 bg-[#0d1016] p-6" aria-labelledby="account-status">
      <div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-full bg-white/5 text-slate-400"><UserRound size={24} /></span><div><h2 id="account-status" className="font-semibold">No account connected</h2><p className="mt-1 text-sm text-slate-400">Profile details will appear after account authentication is available.</p></div></div>
      <dl className="mt-6 divide-y divide-white/10 text-sm"><div className="flex justify-between py-3"><dt className="text-slate-400">Name</dt><dd>Unavailable</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Email</dt><dd>Unavailable</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Session</dt><dd>Public workspace</dd></div></dl>
      <p className="mt-5 text-sm text-slate-500">Sign-in forms are currently a preview. Account verification and profile editing are not connected yet.</p>
      <Link to="/login" className="mt-5 inline-block rounded-md border border-orange-400/40 px-4 py-2 text-sm text-orange-200 hover:bg-orange-500/10">View sign-in form</Link>
    </section>
  </div></AppLayout>;
}
