"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

type Labels = {
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
};

export default function ContactForm({ labels }: { labels: Labels }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(labels.error);
      }

      setStatus("success");
      setMessage(labels.success);
      form.reset();
    } catch {
      setStatus("error");
      setMessage(labels.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form-inner">
      <div className="form-field">
        <label htmlFor="name">{labels.nameLabel}</label>
        <input
          id="name"
          name="name"
          placeholder={labels.namePlaceholder}
          required
          disabled={status === "sending"}
          autoComplete="name"
        />
      </div>
      <div className="form-field">
        <label htmlFor="email">{labels.emailLabel}</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder={labels.emailPlaceholder}
          required
          disabled={status === "sending"}
          autoComplete="email"
        />
      </div>
      <div className="form-field">
        <label htmlFor="message">{labels.messageLabel}</label>
        <textarea
          id="message"
          name="message"
          placeholder={labels.messagePlaceholder}
          required
          disabled={status === "sending"}
          rows={5}
        />
      </div>
      <button
        className="button primary"
        type="submit"
        disabled={status === "sending"}>
        {status === "sending" ? labels.sending : labels.submit}
      </button>
      {message ? (
        <p className="form-status" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
