import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Headphones,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

const HERO_IMAGE = "/manus-storage/kway-fleet-hero_193621b8.jpg";

type FormErrors = {
  email?: string;
  password?: string;
};

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("kway-portal-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!email.trim()) {
      nextErrors.email = "Enter your work email or employee ID.";
    } else if (email.includes("@") && !/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Enter a valid work email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    } else if (password.length < 6) {
      nextErrors.password = "Password must contain at least 6 characters.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (rememberMe) {
      window.localStorage.setItem("kway-portal-email", email.trim());
    } else {
      window.localStorage.removeItem("kway-portal-email");
    }

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      toast.success("Sign-in form verified", {
        description: "Secure portal authentication can now be connected to this interface.",
      });
    }, 800);
  };

  const showDemoNotice = (feature: string) => {
    toast.info(`${feature} is ready for integration`, {
      description: "This front-end preview is not connected to a live support or identity service yet.",
    });
  };

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#102033] lg:grid lg:grid-cols-[minmax(0,1.18fr)_minmax(450px,0.82fr)]">
      <section
        className="hero-panel relative hidden min-h-screen overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        aria-label="K-Way freight truck travelling on a highway"
      >
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(7,19,34,0.97)_0%,rgba(7,19,34,0.76)_48%,rgba(7,19,34,0.24)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,11,22,0.18)_0%,rgba(2,11,22,0.08)_48%,rgba(2,11,22,0.86)_100%)]" />
        <div className="route-grid absolute inset-0 opacity-35" />

        <header className="relative z-10 flex items-center justify-between px-12 py-9 xl:px-16">
          <BrandMark light />
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold tracking-[0.16em] text-white/85 uppercase backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#f6903d] opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-[#f6903d]" />
            </span>
            Operations online
          </div>
        </header>

        <div className="relative z-10 max-w-[650px] px-12 pb-12 xl:px-16 xl:pb-14">
          <div className="mb-6 flex items-center gap-3 text-xs font-bold tracking-[0.2em] text-[#ff9a4b] uppercase">
            <span className="h-px w-9 bg-[#ff8c35]" />
            Moving business forward
          </div>
          <h1 className="font-display max-w-[620px] text-[clamp(3.3rem,5.2vw,5.4rem)] leading-[0.9] font-bold tracking-[-0.025em] text-white uppercase">
            Every mile.
            <span className="block text-[#ff8c35]">Delivered.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[15px] leading-7 text-slate-200/85">
            One secure workspace for K-Way teams to manage routes, track movement, and keep every delivery on schedule.
          </p>

          <div className="mt-9 grid max-w-[590px] grid-cols-3 gap-3">
            <Metric value="24/7" label="Dispatch support" />
            <Metric value="Live" label="Fleet visibility" />
            <Metric value="Secure" label="Team access" />
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-white/60">
            <MapPin className="size-3.5 text-[#ff8c35]" strokeWidth={2.5} />
            Reliable transport. Clear communication. Trusted delivery.
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f6f2]">
        <div className="pointer-events-none absolute -right-28 -top-28 size-[360px] rounded-full bg-[#ff8c35]/8 blur-3xl" />
        <div className="mobile-hero relative h-44 overflow-hidden lg:hidden" style={{ backgroundImage: `url(${HERO_IMAGE})` }}>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,19,34,0.94),rgba(7,19,34,0.38))]" />
          <div className="relative z-10 flex h-full items-start justify-between px-6 py-6">
            <BrandMark light compact />
            <span className="mt-1 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-bold tracking-[0.14em] text-white uppercase backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-[#ff8c35]" /> Online
            </span>
          </div>
        </div>

        <div className="relative z-10 hidden items-center justify-between px-9 py-8 lg:flex xl:px-14">
          <span className="text-xs font-semibold tracking-[0.02em] text-[#5c6774]">Secure employee portal</span>
          <button
            type="button"
            onClick={() => showDemoNotice("Support access")}
            className="group flex items-center gap-2 text-xs font-bold text-[#263647] transition-colors duration-200 hover:text-[#cf5c10] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d96519]"
          >
            <Headphones className="size-4 text-[#d96519] transition-transform duration-200 group-hover:-rotate-6" />
            Need help?
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10 lg:px-12 lg:py-6 xl:px-20">
          <div className="form-enter w-full max-w-[440px]">
            <div className="mb-8 hidden lg:block">
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#112438] shadow-[0_12px_30px_rgba(17,36,56,0.16)]">
                <LockKeyhole className="size-5 text-[#ff8c35]" strokeWidth={2.2} />
              </div>
            </div>

            <p className="mb-3 text-[11px] font-extrabold tracking-[0.2em] text-[#d96519] uppercase">K-Way team access</p>
            <h2 className="font-display text-[2.65rem] leading-none font-bold tracking-[-0.02em] text-[#102033] uppercase sm:text-5xl">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6c7680]">
              Sign in to continue to your transport operations workspace.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#25374a]">
                  Work email or employee ID
                </label>
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#87919c] transition-colors group-focus-within:text-[#d96519]" />
                  <input
                    id="email"
                    name="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
                    }}
                    autoComplete="username"
                    placeholder="name@kwaylimited.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={`h-13 w-full rounded-xl border bg-white pl-12 pr-4 text-sm text-[#102033] shadow-[0_4px_16px_rgba(16,32,51,0.04)] outline-none transition-all duration-200 placeholder:text-[#a3abb3] focus:border-[#d96519] focus:ring-4 focus:ring-[#ff8c35]/10 ${errors.email ? "border-red-400" : "border-[#dfe2df]"}`}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-2 text-xs font-medium text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-bold text-[#25374a]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => showDemoNotice("Password recovery")}
                    className="text-xs font-bold text-[#c9580e] underline-offset-4 transition-colors hover:text-[#9f4105] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d96519]"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="group relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#87919c] transition-colors group-focus-within:text-[#d96519]" />
                  <input
                    id="password"
                    name="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    className={`h-13 w-full rounded-xl border bg-white pl-12 pr-12 text-sm text-[#102033] shadow-[0_4px_16px_rgba(16,32,51,0.04)] outline-none transition-all duration-200 placeholder:text-[#a3abb3] focus:border-[#d96519] focus:ring-4 focus:ring-[#ff8c35]/10 ${errors.password ? "border-red-400" : "border-[#dfe2df]"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#77828d] transition-colors hover:text-[#102033] focus-visible:outline-2 focus-visible:outline-[#d96519]"
                  >
                    {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-2 text-xs font-medium text-red-600">
                    {errors.password}
                  </p>
                )}
              </div>

              <label className="flex w-fit items-center gap-3 text-xs font-semibold text-[#566371]">
                <span className="relative flex size-5 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="peer size-5 appearance-none rounded-[6px] border border-[#cfd4d1] bg-white shadow-sm transition-colors checked:border-[#d96519] checked:bg-[#d96519] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d96519]"
                  />
                  <Check className="pointer-events-none absolute size-3.5 scale-75 text-white opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100" strokeWidth={3} />
                </span>
                Keep me signed in on this device
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex h-13 w-full items-center justify-center gap-3 rounded-xl bg-[#112438] px-5 text-sm font-extrabold tracking-[0.01em] text-white shadow-[0_14px_30px_rgba(17,36,56,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#19334b] hover:shadow-[0_18px_38px_rgba(17,36,56,0.24)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-[#ff8c35]" />
                    Verifying access
                  </>
                ) : (
                  <>
                    Sign in to portal
                    <ArrowRight className="size-4 text-[#ff8c35] transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#e1e3df] bg-white/75 p-4">
              <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-[#d96519]" strokeWidth={2.2} />
              <p className="text-[11px] leading-5 text-[#747e87]">
                Protected access for authorised K-Way personnel. Activity may be monitored to keep company and customer data secure.
              </p>
            </div>
          </div>
        </div>

        <footer className="relative z-10 flex items-center justify-between border-t border-[#e3e3df] px-6 py-5 text-[10px] font-semibold text-[#818a91] sm:px-10 lg:px-12 xl:px-14">
          <span>© 2026 K-Way Limited</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => showDemoNotice("Privacy notice")} className="hover:text-[#c9580e]">Privacy</button>
            <button type="button" onClick={() => showDemoNotice("Terms of use")} className="hover:text-[#c9580e]">Terms</button>
          </div>
        </footer>
      </section>
    </main>
  );
}

function BrandMark({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="K-Way Limited">
      <span className={`${compact ? "size-9" : "size-10"} relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#ff8c35] text-[#0b1b2c] shadow-[0_10px_24px_rgba(0,0,0,0.18)]`}>
        <Truck className={compact ? "size-5" : "size-[22px]"} strokeWidth={2.5} />
        <span className="absolute bottom-0 left-0 h-[3px] w-full bg-white/70" />
      </span>
      <span className="leading-none">
        <span className={`font-display block text-[1.35rem] font-bold tracking-[0.02em] uppercase ${light ? "text-white" : "text-[#102033]"}`}>
          K-Way
        </span>
        <span className={`mt-1 block text-[8px] font-bold tracking-[0.3em] uppercase ${light ? "text-white/55" : "text-[#6e7780]"}`}>
          Limited
        </span>
      </span>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-md">
      <div className="font-display text-2xl font-bold tracking-wide text-white uppercase">{value}</div>
      <div className="mt-1 text-[10px] font-semibold tracking-[0.06em] text-white/55 uppercase">{label}</div>
    </div>
  );
}
