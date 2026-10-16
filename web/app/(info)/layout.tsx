import Link from "next/link";
import Footer from "@/components/Footer";

export default function InfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="glass sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href="/" className="font-mont text-xl font-extrabold tracking-tight">
          GetUsim
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm hover:bg-black/5"
        >
          <i className="fa-solid fa-house" aria-hidden /> 홈
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
