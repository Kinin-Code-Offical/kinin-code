export const profile = {
  name: "Yamac",
  roles: ["Electrical & Electronics Student", "Full-stack Builder"],
  location: "Ankara, Türkiye",
  introLines: [
    "Booting ED-Linux 1.0 LTS...",
    "Loading user profile: Yamac",
    "Mounting /home/yamac",
    "Type \"help\" to see commands.",
  ],
  menu: [
    { id: "home", label: "Home" },
    { id: "about", label: "About" },
    { id: "projects", label: "Projects" },
    { id: "contact", label: "Contact" },
  ],
  socials: [
    {
      label: "GitHub",
      href: "https://github.com/Kinin-Code-Offical",
      icon: "GH",
    },
    {
      label: "Email",
      href: "mailto:hello@kinin.dev",
      icon: "@",
    },
  ],
  terminal: {
    prompt: "yamac@edsh:~$",
    helpText:
      "Commands: help, ls, cd, pwd, show <file.md>, show -all, echo <text>, hello, mkdir <name>, touch <name>",
  },
  contactForm: {
    nameLabel: "Name",
    namePlaceholder: "Your name",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    messageLabel: "Project",
    messagePlaceholder: "What should we build?",
    submit: "Send Message",
    sending: "Sending...",
    success: "Message received. I’ll reply soon.",
    error: "Something went wrong. Please try again.",
  },
  sections: ["home", "about", "projects", "contact"],
} as const;
