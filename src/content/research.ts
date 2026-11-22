// Research / writing shown in the "research" section, the terminal and llms.txt.
// Source: the public OSF project https://osf.io/ewmsf/ (PDF: Discrete_Mode_Structure_of_Time.pdf).
// It also closes off an earlier, unpublished idea (deriving the structure from a
// five-dimensional geometry): §12–13 show why that derivation fails.

export const research = [
  {
    id: "discrete-mode-structure-of-time",
    shortTitle: "OSF",
    title: {
      tr: "Zamanın Ayrık Mod Yapısı: Koherans Canlanması ve Parametresiz Bir Oran Bağıntısı",
      en: "The Discrete Mode Structure of Time: Coherence Revival, a Parameter-Free Ratio Relation",
    },
    subtitle: {
      tr: "…ve geometrik türetimin neden kapalı olduğu",
      en: "…and Why the Geometric Derivation Is Closed",
    },
    date: "2026-08-09",
    dateLabel: { tr: "9 Ağustos 2026", en: "August 9, 2026" },
    role: { tr: "Bağımsız araştırmacı", en: "Independent researcher" },
    field: {
      tr: "Teorik fizik · zaman ve dekoherans",
      en: "Theoretical physics · time and decoherence",
    },
    summary: {
      tr: "Zamanın evrensel aralıklı, ayrık bir mod tarağı taşıdığını varsayan ve gözlemsel sonuçlarını çıkaran bir model. Tek bir ayrık adım tekdüze sönüm üretirken tarak yapısı koherans canlanması (revival) üretir; bu imzayı sürekli dağılımlı hiçbir teknik gürültü taklit edemez. Makale optik saatlerle sınanabilir parametresiz bağıntılar türetir, sınamak için gereken veri kalitesini sayısal olarak belirler ve beş boyutlu geometrik türetimin neden geçersiz olduğunu teorem düzeyinde gösterir.",
      en: "A model that postulates time carries a discrete mode comb with universal spacing and works out the observational consequences. A single discrete step gives monotonic damping, whereas a comb gives coherence revival — a signature no continuously distributed technical noise can mimic. The paper derives parameter-free relations testable with optical clocks, quantifies the data quality needed to test them, and shows at theorem level why the five-dimensional geometric derivation fails.",
    },
    stats: [
      { value: "14", label: { tr: "sayfa", en: "pages" } },
      { value: "2", label: { tr: "serbest parametre (δ, nᵣₘₛ)", en: "free parameters (δ, nᵣₘₛ)" } },
      { value: "≈210 s", label: { tr: "beklenen canlanma (nᵣₘₛ ≈ 0,1)", en: "expected revival (nᵣₘₛ ≈ 0.1)" } },
      { value: "10¹⁰", label: { tr: "5B türetimdeki kısıt çelişkisi", en: "constraint violation of the 5D derivation" } },
    ],
    highlights: {
      tr: [
        "Parametresiz bağıntılar: t(canlanma) / t(dekoherans) = 2π·nᵣₘₛ ve türler arasında t(canlanma) ∝ 1/ΔE.",
        "Canlanmayı sürekli dağılımlı hiçbir gürültü kaynağı üretemez (Riemann–Lebesgue); kanal CP-bölünemez olduğundan ölçülebilir bir Markov-dışılık imzasıdır.",
        "⁸⁷Sr verisinin hata bütçesiyle Θ* ≥ 7,4×10⁻⁹ s; nᵣₘₛ ≈ 0,1 için ≈210 s civarında ≈%2 derinlikte canlanma beklenir.",
        "Yayımlanmış veriler bu imzaya kör (Δχ² ≈ 1,6); ayırt etme eşiği: N ≳ 20–30 nokta, Tₘₐₓ ≳ 250–300 s, σ ≲ %1.",
        "Yapıyı beş boyutlu bir geometriden türetme girişiminin kendi Page–Wootters kısıtıyla 10¹⁰ kat çeliştiği teorem düzeyinde gösterilir; bu yaklaşımın iddiaları tek tek geri çekilir.",
      ],
      en: [
        "Parameter-free relations: t(revival) / t(decoherence) = 2π·nᵣₘₛ, and across species t(revival) ∝ 1/ΔE.",
        "No continuously distributed noise source can produce a revival (Riemann–Lebesgue); the channel is CP-indivisible, so revival is a measurable non-Markovianity signature.",
        "From the ⁸⁷Sr error budget: Θ* ≥ 7.4×10⁻⁹ s; for nᵣₘₛ ≈ 0.1 a revival is expected near 210 s with ≈2% modulation depth.",
        "Published data are blind to this signature (Δχ² ≈ 1.6); the discrimination threshold is N ≳ 20–30 points, Tₘₐₓ ≳ 250–300 s, σ ≲ 1%.",
        "Deriving the structure from a five-dimensional geometry is shown, at theorem level, to contradict its own Page–Wootters constraint by a factor of 10¹⁰; that approach’s claims are retracted one by one.",
      ],
    },
    tags: [
      "Discrete time",
      "Coherence revival",
      "Optical clocks",
      "Non-Markovian dynamics",
      "Falsifiability",
    ],
    // First link is the canonical one (used as the ScholarlyArticle url).
    links: [
      {
        href: "https://osf.io/ewmsf/files/b6cre",
        label: { tr: "Makaleyi oku (OSF)", en: "Read the paper (OSF)" },
      },
      {
        href: "https://osf.io/download/b6cre/",
        label: { tr: "PDF indir", en: "Download PDF" },
      },
      {
        href: "https://osf.io/ewmsf/",
        label: { tr: "OSF projesi", en: "OSF project" },
      },
    ],
  },
] as const;

export type ResearchItem = (typeof research)[number];
