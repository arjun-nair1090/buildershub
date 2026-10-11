import { useEffect, type ReactNode } from "react";
import { CONTACT_EMAIL, OPERATOR } from "@/config/site";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="font-display text-[24px] leading-tight text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy";
  }, []);
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[38px] leading-tight text-ink sm:text-[46px]">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated 11 Oct 2026</p>
      <p className="mt-6 text-[17px] leading-relaxed text-ink">
        Jewlerify lets you browse jewellery from local stores and check how each piece is verified. You don't need an
        account, and we don't collect personal information from buyers.
      </p>

      <Section title="Who runs Jewlerify">
        <p>Jewlerify is run by {OPERATOR}. You can reach us at {CONTACT_EMAIL}.</p>
      </Section>
      <Section title="What buyers share">
        <p>Nothing personal. There are no buyer accounts, no sign-up and no forms that ask for your name, number or email.</p>
      </Section>
      <Section title="Your location">
        <p>
          We only ask for your location when you tap Near me. It is used on your device to sort stores and pieces by
          distance. It is never sent to our servers, put in a link or saved.
        </p>
      </Section>
      <Section title="Saved pieces">
        <p>
          When you tap the heart, the piece or design is saved in this browser's local storage on your device, and so
          is the city you last picked on the browse page. We never receive either. Clearing your browser's site data
          removes them.
        </p>
      </Section>
      <Section title="Protecting the site">
        <p>
          To stop people guessing codes or passwords, we count requests to the verify page and the team login. We keep
          your IP address, and the email typed into the login form, only as a one-way scrambled code, never as they
          are, and delete the counts within a day.
        </p>
      </Section>
      <Section title="Hosting">
        <p>
          The site runs on Vercel, which keeps standard request logs (such as the address a request came from and the
          page requested) to operate and secure its service.
        </p>
      </Section>
      <Section title="Fonts and maps">
        <p>
          Our pages load their fonts from Google Fonts, so Google receives your IP address when a page opens. Store
          pages show a map from OpenStreetMap, which receives your IP address when the map loads. Neither receives
          your location or anything you saved.
        </p>
      </Section>
      <Section title="Store team accounts">
        <p>
          People who manage stores on Jewlerify sign in with a name, an email address and a password. Passwords are
          stored only as a secure hash.
        </p>
      </Section>
      <Section title="Photos">
        <p>Every uploaded photo is re-encoded, which removes hidden details such as where the photo was taken.</p>
      </Section>
      <Section title="Cookies">
        <p>
          We don't use tracking or advertising cookies. The team login is kept in the browser's storage on the team
          member's device.
        </p>
      </Section>
      <Section title="Questions">
        <p>Write to {CONTACT_EMAIL} and we'll answer.</p>
      </Section>
    </article>
  );
}
