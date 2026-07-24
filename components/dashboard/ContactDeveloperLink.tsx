"use client";

type ContactDeveloperLinkProps = {
  mailtoHref: string;
};

export function ContactDeveloperLink({ mailtoHref }: ContactDeveloperLinkProps) {
  return (
    <a
      href={mailtoHref}
      className="text-sm font-medium text-[var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      onClick={(event) => {
        if (
          !window.confirm(
            "Open your email client to contact the developer?",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      Contact the developer
    </a>
  );
}
