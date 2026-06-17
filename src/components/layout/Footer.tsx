import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/routing";

export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tFaq = useTranslations("faq");
  return (
    <footer className="mt-s7 border-t border-line-dark-2 py-s5">
      <Container className="flex flex-col items-center justify-between gap-4 text-fg-dark-soft sm:flex-row">
        <p className="font-sans text-[12px] font-bold uppercase tracking-[0.12em]">
          {t("copyright", { year: new Date().getFullYear() })}
        </p>
        <nav
          aria-label="Footer"
          className="flex items-center gap-4 text-[12px] font-bold uppercase tracking-[0.12em]"
        >
          <Link href="/faq" className="transition-colors hover:text-fg-dark">
            {tFaq("title")}
          </Link>
          <Link href="/check" className="transition-colors hover:text-fg-dark">
            {tNav("check")}
          </Link>
          <Link href="/contact" className="transition-colors hover:text-fg-dark">
            {tNav("contact")}
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
