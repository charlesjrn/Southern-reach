import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Globe, Mail, MapPin, Megaphone, Phone, PenTool, ShieldCheck, Target, Users } from "lucide-react";
import { needsSetup } from "@/lib/admin.functions";

const EMAIL = "admin@southernreachmarketing.com.au";
const PHONE_DISPLAY = "0485 607 123";
const PHONE_TEL = "0485607123";

const SERVICES = [
  {
    icon: Globe,
    title: "Web development",
    body: "Fast, responsive, and well-designed websites built to attract visitors and drive customer enquiries.",
  },
  {
    icon: Megaphone,
    title: "Digital marketing",
    body: "Targeted campaigns and search strategies that boost online visibility and attract quality leads.",
  },
  {
    icon: PenTool,
    title: "Content strategy",
    body: "Compelling copywriting and blog articles that engage your audience and build industry authority.",
  },
  {
    icon: Target,
    title: "Lead generation",
    body: "Landing pages and automated appointment funnels that streamline client bookings.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Southern Reach Marketing completely transformed our online presence. Our client enquiries doubled within the first two months.",
    name: "Liam Davies",
  },
  {
    quote:
      "The attention to detail and proactive communication made working remotely seamless. The new website looks fantastic and converts brilliantly.",
    name: "Sarah Jenkins",
  },
  {
    quote:
      "With five years of industry expertise clearly evident, they gave our business the digital strategy we needed to book more appointments.",
    name: "Callum Harris",
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Southern Reach Marketing | Web Development & Digital Marketing" },
      {
        name: "description",
        content:
          "Southern Reach Marketing builds high-converting websites and digital marketing campaigns for businesses across Australia. Based in Launceston, Tasmania.",
      },
      // The root layout sets noindex for the staff platform; the public homepage should be indexable.
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Southern Reach Marketing" },
      {
        property: "og:description",
        content: "Websites and digital marketing that turn visitors into clients. Launceston, Tasmania, serving Australia.",
      },
    ],
  }),
  loader: async () => {
    // Keep first-run setup working: with no admin yet, send the visitor to /setup.
    const { needsSetup: setup } = await needsSetup();
    if (setup) throw redirect({ to: "/setup" });
    return null;
  },
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-brand text-sidebar-accent-foreground">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary font-display font-bold text-sidebar-primary-foreground">
              SR
            </span>
            <span className="font-display text-base font-semibold">Southern Reach Marketing</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#services" className="hover:underline">Services</a>
            <a href="#about" className="hover:underline">About</a>
            <a href="#clients" className="hover:underline">Clients</a>
            <a href="#contact" className="hover:underline">Contact</a>
          </nav>
          <Link
            to="/login"
            className="rounded-md border border-sidebar-accent-foreground/30 px-3 py-1.5 text-sm font-medium hover:bg-sidebar-accent-foreground/10"
          >
            Staff sign-in
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="relative overflow-hidden bg-brand text-sidebar-accent-foreground">
          <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-foreground">
              Launceston, Tasmania · Working Australia-wide
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-5xl">
              Grow your business with digital strategies that deliver results
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-sidebar-foreground">
              We craft high-converting websites and modern marketing campaigns tailored to your goals.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-md bg-sidebar-primary px-5 py-3 font-semibold text-sidebar-primary-foreground hover:opacity-90"
              >
                Book a consultation <ArrowRight className="size-4" />
              </a>
              <a
                href="#services"
                className="inline-flex items-center rounded-md border border-sidebar-accent-foreground/30 px-5 py-3 font-semibold hover:bg-sidebar-accent-foreground/10"
              >
                Our services
              </a>
            </div>
          </div>
        </section>

        <section id="services" className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-3xl font-semibold">Tailored digital solutions</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              With over five years of experience, we offer web development and digital marketing to help your brand stand
              out and turn visitors into loyal clients.
            </p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-6 shadow-card">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="bg-muted/40 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold">About Southern Reach Marketing</h2>
              <p className="mt-4 text-muted-foreground">
                Based in Launceston, Tasmania, and servicing businesses remotely nationwide, we bring five years of hands-on
                experience in web development and strategic marketing.
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">
                We combine technical expertise with transparent communication to help ambitious brands reach their full
                potential. Every project is crafted to engage audiences and generate measurable commercial results.
              </p>
              <div className="mt-6 flex items-center gap-3 text-sm font-medium text-primary">
                <ShieldCheck className="size-4" /> Transparent communication, measurable results
              </div>
            </div>
          </div>
        </section>

        <section id="clients" className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="font-display text-3xl font-semibold">What clients say</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="rounded-xl border bg-card p-6 shadow-card">
                  <blockquote className="text-sm italic text-muted-foreground">"{t.quote}"</blockquote>
                  <figcaption className="mt-4 font-semibold">{t.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-brand py-20 text-sidebar-accent-foreground">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold">Ready to elevate your online reach?</h2>
              <p className="mt-4 text-sidebar-foreground">
                Whether you need a new website, a rebrand, or a steady flow of client bookings, let's build something
                remarkable together.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-sidebar-primary" />
                <div>
                  <p className="font-semibold">Southern Reach Marketing</p>
                  <p className="text-sidebar-foreground">Launceston TAS 7250, Australia</p>
                  <p className="text-sidebar-foreground">Operating remotely across Australia</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="size-5 shrink-0 text-sidebar-primary" />
                <a href={`mailto:${EMAIL}`} className="hover:underline">{EMAIL}</a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-5 shrink-0 text-sidebar-primary" />
                <a href={`tel:${PHONE_TEL}`} className="hover:underline">{PHONE_DISPLAY}</a>
              </div>
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("Enquiry from southernreachmarketing.com.au")}`}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-sidebar-primary px-5 py-3 font-semibold text-sidebar-primary-foreground hover:opacity-90"
              >
                Send us an email <ArrowRight className="size-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand px-5 py-8 text-center text-sm text-sidebar-foreground">
        <p>© {new Date().getFullYear()} Southern Reach Marketing · Launceston, Tasmania, Australia</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link to="/login" className="inline-flex items-center gap-1 hover:underline">
            <Users className="size-3.5" /> Staff sign-in
          </Link>
          <Link to="/admin-login" className="inline-flex items-center gap-1 hover:underline">
            <ShieldCheck className="size-3.5" /> Admin portal
          </Link>
        </p>
      </footer>
    </div>
  );
}
