// Research / writing shown in the "research" section and in the terminal.
// Source: D:\ZMUT (LaTeX source, PDFs and the internal stress-test report).

export const research = [
  {
    id: "zmut",
    shortTitle: "ZMUT",
    title: {
      tr: "Çok-Modlu Öz-Zaman Uzay–Zaman Formalizmi (ZMUT)",
      en: "Multi-Mode Proper-Time Spacetime Formalism (ZMUT)",
    },
    subtitle: {
      tr: "Birleşik kuram: aksiyomatik inşa, öz-eleştirel denetim, sistematik çürütme sınamaları ve klasik karşılıklılık",
      en: "A unified theory: axiomatic construction, self-critical audit, systematic refutation tests and classical correspondence",
    },
    date: "2026-08-06",
    dateLabel: { tr: "6 Ağustos 2026", en: "August 6, 2026" },
    role: { tr: "Bağımsız araştırmacı", en: "Independent researcher" },
    field: {
      tr: "Teorik fizik · kuantum kütle çekimi",
      en: "Theoretical physics · quantum gravity",
    },
    summary: {
      tr: "Öz-zamanı Hilbert uzayında normalize bir zamansal mod dalga fonksiyonu olarak ele alan bir kuram. Genişletilmiş (4+1) boyutlu bir manifold üzerindeki tek bir master eylemden mod-Klein–Gordon ve genişletilmiş Einstein denklemleri türetiliyor; Newton yasası, Schrödinger denklemi ve klasik fizik limit teoremleri olarak geri kazanılıyor ve kuram güncel deney verileriyle yüzleştiriliyor.",
      en: "A theory that represents proper time as a normalised temporal-mode wave function in Hilbert space. A single master action on an extended (4+1)-dimensional manifold yields the mode Klein–Gordon and extended Einstein equations; Newton's law, the Schrödinger equation and classical physics are recovered as limit theorems, and the theory is confronted with current experimental data.",
    },
    stats: [
      { value: "48", label: { tr: "sayfa", en: "pages" } },
      { value: "25/25", label: { tr: "tersten doğrulama", en: "reverse checks" } },
      { value: "79/79", label: { tr: "stres testi", en: "stress tests" } },
      { value: "0", label: { tr: "çelişki / 14 veri sınıfı", en: "conflicts / 14 data classes" } },
    ],
    highlights: {
      tr: [
        "Planck kütlesi, λₘ = ħ/mc² bağıntısıyla doğal kuantum–klasik eşik olarak ortaya çıkıyor.",
        "Dokuz yapısal zayıflık (Z1–Z9) teşhis edilip teorem düzeyinde kapatılıyor.",
        "Karanlık enerji lif ölçeğiyle özdeşleşiyor: c·ℓξ ≈ 88 µm.",
        "Deneysel sınırlar: Θ* ≥ 2,6×10⁻⁹ s ve αξ ≲ 1,1×10⁻⁴; birincil sınama ²²⁹Th koherans bandı [4,3 – 66] s.",
      ],
      en: [
        "The Planck mass emerges as the natural quantum–classical threshold via λₘ = ħ/mc².",
        "Nine structural weaknesses (Z1–Z9) are diagnosed and closed at theorem level.",
        "Dark energy is identified with the fibre scale: c·ℓξ ≈ 88 µm.",
        "Experimental bounds: Θ* ≥ 2.6×10⁻⁹ s and αξ ≲ 1.1×10⁻⁴; primary test is the ²²⁹Th coherence band [4.3 – 66] s.",
      ],
    },
    tags: [
      "Quantum gravity",
      "Proper time",
      "Decoherence",
      "Quantum information",
      "Cosmology",
    ],
    links: [
      {
        href: "/papers/zmut/zmut-tr.pdf",
        label: { tr: "Makale (TR, PDF)", en: "Paper (TR, PDF)" },
      },
      {
        href: "/papers/zmut/zmut-en.pdf",
        label: { tr: "Paper (EN, PDF)", en: "Paper (EN, PDF)" },
      },
    ],
  },
] as const;

export type ResearchItem = (typeof research)[number];
