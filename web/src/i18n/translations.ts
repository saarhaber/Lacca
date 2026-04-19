export type Locale = "en" | "es" | "fr" | "de" | "it" | "pt" | "ja" | "zh" | "ko" | "he";

export type TranslationKeys = {
  // Meta
  "meta.title": string;
  "meta.description": string;

  // Hero
  "hero.eyebrow": string;
  "hero.title": string;
  "hero.lede": string; // HTML — contains <abbr> tags

  // Main nav / inspiration grid (optional — English fallback for locales not yet updated)
  "nav.match"?: string;
  "nav.gallery"?: string;
  "nav.tabsAria"?: string;
  "gallery.intro"?: string; // HTML
  "gallery.count"?: string; // {n}
  "gallery.hint"?: string;
  "gallery.openAria"?: string; // {caption}
  "gallery.lbClose"?: string;
  "gallery.lbPrev"?: string;
  "gallery.lbNext"?: string;
  "gallery.lbCounter"?: string; // {current} {total}

  // Form labels
  "form.make.label": string;
  "form.make.tip": string;
  "form.make.tipLabel": string;
  "form.make.tipText": string;
  "form.model.label": string;
  "form.paint.label": string;
  "form.paint.tipLabel": string;
  "form.paint.tipText": string;
  "form.submit": string;

  // Dropdowns — placeholders / loading states
  "dropdown.loadingMakes": string;
  "dropdown.selectMake": string;
  "dropdown.pickMakeFirst": string;
  "dropdown.loadingModels": string;
  "dropdown.selectModel": string;
  "dropdown.pickModelFirst": string;
  "dropdown.selectColor": string;

  // Optgroup labels
  "optgroup.withData": string;
  "optgroup.allMakes": string;
  "optgroup.allModels": string;
  "optgroup.genericColors": string;
  // Optional v1.3 key: makes/models we recognize but don't have a factory
  // paint catalog for yet. Falls back to English when a locale omits it.
  "optgroup.modelsOnly"?: string;

  // Availability note
  "availability.noData": string; // {make} {model} placeholders

  // Results
  "results.heading": string;
  "results.picksSublabel": string;
  "results.distantBanner": string;
  "results.finishDisclaimer": string;
  "results.tierLegend": string; // HTML

  // Optional: new keys introduced in v1.1 UX pass. Marked optional so existing
  // locale dicts don't have to be touched in lockstep — t() falls back to en.
  "results.gamutWarning"?: string;
  "tooltip.capped"?: string;
  "tooltip.finishPenalty"?: string;
  "tooltip.source"?: string;

  // VIN input (v1.2). Optional — English-only until locales are updated.
  "form.vin.label"?: string;
  "form.vin.placeholder"?: string;
  "form.vin.decode"?: string;
  "form.vin.decoding"?: string;
  "form.vin.tipLabel"?: string;
  "form.vin.tipText"?: string;
  "form.vin.invalid"?: string;
  "form.vin.notFound"?: string;
  "form.vin.success"?: string; // {year} {make} {model}
  "optgroup.fromVin"?: string;

  // Tier labels
  "tier.perfect": string;
  "tier.close": string;
  "tier.explore": string;
  "tier.distant": string;

  // Tier tips
  "tierTip.perfect": string;
  "tierTip.close": string;
  "tierTip.explore": string;
  "tierTip.distant": string;

  // Confidence badge text
  "conf.measured": string;
  "conf.spec": string;
  "conf.derivedHex": string;
  "conf.derivedChip": string;
  "conf.derivedOther": string;
  "conf.estimated": string;
  "conf.generic": string;

  // Confidence tips
  "confTip.measured": string;
  "confTip.spec": string;
  "confTip.derivedHex": string;
  "confTip.derivedChip": string;
  "confTip.derivedOther": string;
  "confTip.estimated": string;
  "confTip.generic": string;

  // Car swatch title
  "swatch.carTitle": string;

  // Glossary
  "glossary.summary": string;
  "glossary.opi.term": string;
  "glossary.opi.def": string;
  "glossary.deltaE.term": string;
  "glossary.deltaE.def": string; // HTML
  "glossary.lab.term": string;
  "glossary.lab.def": string; // HTML
  "glossary.d65.term": string;
  "glossary.d65.def": string;
  "glossary.finish.term": string;
  "glossary.finish.def": string; // HTML
  "glossary.catalog.term": string;
  "glossary.catalog.def": string;

  // Footer
  "footer.text": string; // HTML
};

const en: TranslationKeys = {
  "meta.title": "Lacca — Car paint to nail color",
  "meta.description":
    "Match your car's exterior paint to OPI nail polish colors using ΔE color science.",

  "hero.eyebrow": "Lacca",
  "hero.title": "The perfect match for your drive — on your nails",
  "hero.lede": `Pick your car's make, model and factory color. Lacca ranks
    <abbr title="OPI is a global nail polish brand — Lacca uses its shades as the target library.">OPI</abbr>
    nail polish shades by a perceptual color distance
    (<abbr title="Delta-E: a single number for how different two colors look. Under 1 is imperceptible.">ΔE</abbr>),
    so lacquer matches lacquer.`,

  "nav.match": "Match",
  "nav.gallery": "Gallery",
  "nav.tabsAria": "Main sections",
  "gallery.intro": `Curated for <strong>color harmony</strong> — <strong>nail polish</strong> with the <strong>car exterior</strong> (paint, wrap, hood, door, fender, bumper — not cabin/dashboard) readable in the same shot. <strong>Hover</strong> for lift; <strong>click</strong> to zoom; use <kbd>←</kbd> <kbd>→</kbd> and <kbd>Esc</kbd> in the lightbox.`,

  "gallery.count": "{n} color stories",
  "gallery.hint": "Tiles are flush for a film-strip feel — peek captions at the bottom of each square.",
  "gallery.openAria": "Open: {caption}",
  "gallery.lbClose": "Close gallery lightbox",
  "gallery.lbPrev": "Previous image",
  "gallery.lbNext": "Next image",
  "gallery.lbCounter": "Image {current} of {total}",

  "form.make.label": "Make",
  "form.make.tip": "what is this?",
  "form.make.tipLabel": "About the Make field",
  "form.make.tipText":
    "Sourced from NHTSA vPIC — a free U.S. government vehicle database. Only some makes have measured paint data in Lacca today — look for the ● mark.",
  "form.model.label": "Model",
  "form.paint.label": "Factory exterior color",
  "form.paint.tipLabel": "About the exterior color field",
  "form.paint.tipText":
    "Official paint code and finish. Finishes: solid (flat), metallic (flakes), pearl (mica shimmer), multi-coat (layered depth), matte (non-reflective).",
  "form.submit": "Find nail color",

  "dropdown.loadingMakes": "Loading makes…",
  "dropdown.selectMake": "Select a make…",
  "dropdown.pickMakeFirst": "Pick a make first",
  "dropdown.loadingModels": "Loading models…",
  "dropdown.selectModel": "Select a model…",
  "dropdown.pickModelFirst": "Pick a model first",
  "dropdown.selectColor": "Select a color…",

  "optgroup.withData": "● With factory paint catalog",
  "optgroup.modelsOnly": "Recognized models (generic colors)",
  "optgroup.allMakes": "All makes (NHTSA vPIC)",
  "optgroup.allModels": "All models (NHTSA)",
  "optgroup.genericColors": "Generic automotive colors (approximate)",

  "availability.noData":
    "No factory paint data for <strong>{make} {model}</strong> yet — matching against <strong>generic automotive colors</strong>. Expect lower accuracy than a named OEM.",

  "results.heading": "Your matches",
  "results.picksSublabel": "Top OPI picks for this paint",
  "results.distantBanner": "No close OPI shade in this catalog yet — expansion pending.",
  "results.finishDisclaimer":
    "Metallic paint shifts with angle — LAB is an average; treat polish picks as direction, not identity.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — perceptually uniform color distance.">ΔE</abbr>
      tiers
    </strong>
    · Excellent &lt;1 (imperceptible) · Close 1–2 · Explore 2–4 (noticeable) · Distant 4+`,

  "results.gamutWarning":
    "Color approximated — outside sRGB display gamut, so this swatch is clipped to the closest on-screen value.",
  "tooltip.capped":
    "Tier capped at Close: this factory paint LAB is approximate, so an Excellent match would require a verified spectrophotometer measurement.",
  "tooltip.finishPenalty":
    "Finish type differs from your car's paint. Picks are ordered by ΔE (color distance); metallics and pearls can still read differently in person.",
  "tooltip.source": "Source: {source}",

  "form.vin.label": "VIN (optional)",
  "form.vin.placeholder": "17-character VIN",
  "form.vin.decode": "Decode",
  "form.vin.decoding": "Decoding…",
  "form.vin.tipLabel": "About the VIN field",
  "form.vin.tipText":
    "Paste the 17-character VIN from your dashboard, door jamb or registration. Lacca decodes it via NHTSA vPIC to auto-fill Make, Model and year. VIN does not encode exterior color — still pick your paint below.",
  "form.vin.invalid":
    "That doesn't look like a valid VIN. VINs are 17 characters, letters only A–Z excluding I, O, Q.",
  "form.vin.notFound":
    "VIN decoded but NHTSA returned no Make/Model — double-check the VIN and try again.",
  "form.vin.success": "Decoded: {year} {make} {model}. Now pick the factory color below.",
  "optgroup.fromVin": "From your VIN",

  "tier.perfect": "Excellent",
  "tier.close": "Close",
  "tier.explore": "Explore",
  "tier.distant": "Distant",

  "tierTip.perfect": "ΔE under 1 — visually identical to most people.",
  "tierTip.close": "ΔE 1–2 — very close match, subtle shift.",
  "tierTip.explore": "ΔE 2–4 — noticeable difference, same family.",
  "tierTip.distant": "ΔE 4+ — clearly different hue or lightness.",

  "conf.measured": "Measured",
  "conf.spec": "From spec",
  "conf.derivedHex": "Hex-derived",
  "conf.derivedChip": "Chip-derived",
  "conf.derivedOther": "Derived (approx.)",
  "conf.estimated": "Estimated",
  "conf.generic": "Generic palette",

  "confTip.measured":
    "Spectrophotometer reading on a physical chip — highest confidence.",
  "confTip.spec": "From an OEM or licensed paint spec sheet.",
  "confTip.derivedHex":
    "Converted from a published or industry touch-up HEX reference.",
  "confTip.derivedChip":
    "Averaged from a PaintRef chip image — wrong row↔chip pairing can skew hue badly.",
  "confTip.derivedOther":
    "Converted or inferred from a secondary catalog source — not a direct spectro measurement.",
  "confTip.estimated": "Approximate value until a verified measurement is available.",
  "confTip.generic":
    "Approximate color from a universal hex-derived palette. Not a factory measurement — add an OEM scope for accuracy.",

  "swatch.carTitle":
    "Approximate color rendered from measured L*a*b* values. Actual appearance varies by screen and finish.",

  "glossary.summary": "What do ΔE, LAB, and OPI mean?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "A global nail polish brand — a salon staple since 1981. Lacca compares your car paint against OPI shades; any lacquer library with LAB values would work the same way.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `A single number for how different two colors look.
    <strong>&lt;1</strong> imperceptible ·
    <strong>1–2</strong> close ·
    <strong>2–4</strong> noticeable ·
    <strong>4+</strong> clearly different.
    Lacca ranks with <strong>CIEDE2000</strong>, which weights lightness, chroma, and
    hue the way human vision does — more accurate than the older CIE76 for subtle
    greys and neutrals. Catalog files declare which formula was used so the math stays
    reproducible.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `A color space designed to match how humans see color.
    <strong>L*</strong> = lightness (0 black → 100 white),
    <strong>a*</strong> = green↔red,
    <strong>b*</strong> = blue↔yellow.`,
  "glossary.d65.term": "D65 / 2° observer",
  "glossary.d65.def":
    "Reference lighting and viewing angle for color measurements — roughly daylight at noon, seen head-on. Colors can only be compared when measured under the same conditions.",
  "glossary.finish.term": "Finish",
  "glossary.finish.def": `<strong>Solid</strong> — uniform flat paint.
    <strong>Metallic</strong> — aluminum flakes that shift with light.
    <strong>Pearl</strong> — mica pigments with soft shimmer.
    <strong>Multi-Coat</strong> — several layers (Tesla's specialty) for depth and richness.
    <strong>Matte</strong> — non-reflective.`,
  "glossary.catalog.term": "Catalog / SKU",
  "glossary.catalog.def":
    "SKU is the unique product code for a single polish. The catalog groups many SKUs with a shared version and measurement conditions.",

  "footer.text": `The make/model list is pulled live from the free
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>
    vehicle database. Named paint coverage: <strong>Tesla Model 3 / Model Y</strong> and
    <strong>BMW X-line (X1–X7, iX, XM)</strong> for North America, 2020–2026. Every other
    make/model falls back to a <strong>generic hex-derived palette</strong> so matching is
    universal but approximate outside the named OEMs — look for the <em>generic</em> badge.`,
};

const es: TranslationKeys = {
  "meta.title": "Lacca — Color de pintura de auto a esmalte de uñas",
  "meta.description":
    "Combina la pintura exterior de tu auto con colores de esmalte OPI usando ciencia del color ΔE.",

  "hero.eyebrow": "Lacca",
  "hero.title": "El par perfecto para tu auto — en tus uñas",
  "hero.lede": `Elige la marca, modelo y color de fábrica de tu auto. Lacca clasifica los esmaltes
    <abbr title="OPI es una marca global de esmaltes — Lacca usa sus tonos como biblioteca objetivo.">OPI</abbr>
    por distancia de color perceptual
    (<abbr title="Delta-E: un número único que indica cuán diferentes se ven dos colores. Menos de 1 es imperceptible.">ΔE</abbr>),
    para que la laca combine con la laca.`,

  "form.make.label": "Marca",
  "form.make.tip": "¿qué es esto?",
  "form.make.tipLabel": "Sobre el campo Marca",
  "form.make.tipText":
    "Obtenido de NHTSA vPIC — base de datos gratuita de vehículos del gobierno de EE. UU. Solo algunas marcas tienen datos de pintura medidos en Lacca — busca el símbolo ●.",
  "form.model.label": "Modelo",
  "form.paint.label": "Color exterior de fábrica",
  "form.paint.tipLabel": "Sobre el campo de color exterior",
  "form.paint.tipText":
    "Código de pintura oficial y acabado. Acabados: sólido (plano), metálico (escamas), perla (brillo con mica), multicapa (profundidad), mate (no reflectivo).",
  "form.submit": "Encontrar color de esmalte",

  "dropdown.loadingMakes": "Cargando marcas…",
  "dropdown.selectMake": "Selecciona una marca…",
  "dropdown.pickMakeFirst": "Elige una marca primero",
  "dropdown.loadingModels": "Cargando modelos…",
  "dropdown.selectModel": "Selecciona un modelo…",
  "dropdown.pickModelFirst": "Elige un modelo primero",
  "dropdown.selectColor": "Selecciona un color…",

  "optgroup.withData": "● Con datos de pintura medidos",
  "optgroup.allMakes": "Todas las marcas (NHTSA vPIC)",
  "optgroup.allModels": "Todos los modelos (NHTSA)",
  "optgroup.genericColors": "Colores automotrices genéricos (aproximados)",

  "availability.noData":
    "Sin datos de pintura de fábrica para <strong>{make} {model}</strong> aún — comparando con <strong>colores automotrices genéricos</strong>. Se espera menor precisión que con un OEM nombrado.",

  "results.heading": "Tus coincidencias",
  "results.picksSublabel": "Mejores opciones OPI para esta pintura",
  "results.distantBanner": "Ningún tono OPI cercano en este catálogo aún — expansión pendiente.",
  "results.finishDisclaimer":
    "La pintura metálica cambia con el ángulo — LAB es un promedio; toma las sugerencias como orientación, no identidad.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — distancia de color perceptualmente uniforme.">ΔE</abbr>
      niveles
    </strong>
    · Excelente &lt;1 (imperceptible) · Cercano 1–2 · Explorar 2–4 (notable) · Distante 4+`,

  "tier.perfect": "Excelente",
  "tier.close": "Cercano",
  "tier.explore": "Explorar",
  "tier.distant": "Distante",

  "tierTip.perfect": "ΔE menor a 1 — visualmente idéntico para la mayoría.",
  "tierTip.close": "ΔE 1–2 — muy buena coincidencia, diferencia sutil.",
  "tierTip.explore": "ΔE 2–4 — diferencia notable, misma familia de color.",
  "tierTip.distant": "ΔE 4+ — tono o luminosidad claramente diferente.",

  "conf.measured": "Medido",
  "conf.spec": "Desde especificación",
  "conf.derivedHex": "Derivado de HEX",
  "conf.derivedChip": "Derivado de chip",
  "conf.derivedOther": "Derivado (aprox.)",
  "conf.estimated": "Estimado",
  "conf.generic": "Paleta genérica",

  "confTip.measured":
    "Lectura con espectrofotómetro en una muestra física — mayor confianza.",
  "confTip.spec": "De una hoja de especificación OEM o con licencia.",
  "confTip.derivedHex":
    "Convertido desde un HEX publicado o de referencia de retoque.",
  "confTip.derivedChip":
    "Promediado desde una imagen de chip PaintRef — un emparejamiento fila↔chip incorrecto puede sesgar el tono.",
  "confTip.derivedOther":
    "Convertido o inferido desde una fuente secundaria — no es una medición directa por espectro.",
  "confTip.estimated": "Valor aproximado hasta que haya una medición verificada disponible.",
  "confTip.generic":
    "Color aproximado de una paleta universal derivada de HEX. No es una medición de fábrica.",

  "swatch.carTitle":
    "Color aproximado renderizado desde valores L*a*b* medidos. La apariencia real varía según pantalla y acabado.",

  "glossary.summary": "¿Qué significan ΔE, LAB y OPI?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "Una marca global de esmaltes de uñas — elemento fijo en salones desde 1981. Lacca compara la pintura de tu auto con los tonos OPI.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `Un número único que indica cuán diferentes se ven dos colores.
    <strong>&lt;1</strong> imperceptible ·
    <strong>1–2</strong> cercano ·
    <strong>2–4</strong> notable ·
    <strong>4+</strong> claramente diferente.
    Lacca clasifica con <strong>CIEDE2000</strong>, que pondera luminosidad, croma y tono como lo hace la visión humana.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `Espacio de color diseñado para coincidir con la percepción humana.
    <strong>L*</strong> = luminosidad (0 negro → 100 blanco),
    <strong>a*</strong> = verde↔rojo,
    <strong>b*</strong> = azul↔amarillo.`,
  "glossary.d65.term": "D65 / observador 2°",
  "glossary.d65.def":
    "Iluminación y ángulo de visión de referencia para mediciones de color — aproximadamente luz diurna al mediodía, visto de frente.",
  "glossary.finish.term": "Acabado",
  "glossary.finish.def": `<strong>Sólido</strong> — pintura plana uniforme.
    <strong>Metálico</strong> — escamas de aluminio que cambian con la luz.
    <strong>Perla</strong> — pigmentos de mica con brillo suave.
    <strong>Multicapa</strong> — varias capas para profundidad y riqueza.
    <strong>Mate</strong> — no reflectivo.`,
  "glossary.catalog.term": "Catálogo / SKU",
  "glossary.catalog.def":
    "SKU es el código de producto único para un esmalte. El catálogo agrupa muchos SKUs con una versión y condiciones de medición compartidas.",

  "footer.text": `La lista de marcas/modelos se obtiene en vivo de la base de datos gratuita
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>.
    Cobertura nombrada: <strong>Tesla Model 3 / Model Y</strong> y
    <strong>BMW X-line (X1–X7, iX, XM)</strong> para Norteamérica, 2020–2026.
    Todos los demás modelos usan una <strong>paleta genérica derivada de HEX</strong>.`,
};

const fr: TranslationKeys = {
  "meta.title": "Lacca — Couleur de peinture auto en vernis à ongles",
  "meta.description":
    "Associez la peinture extérieure de votre voiture aux couleurs de vernis OPI grâce à la science des couleurs ΔE.",

  "hero.eyebrow": "Lacca",
  "hero.title": "La correspondance parfaite pour votre voiture — sur vos ongles",
  "hero.lede": `Choisissez la marque, le modèle et la couleur d'usine de votre voiture. Lacca classe les vernis
    <abbr title="OPI est une marque mondiale de vernis à ongles — Lacca utilise ses teintes comme bibliothèque cible.">OPI</abbr>
    par distance de couleur perceptuelle
    (<abbr title="Delta-E : un seul chiffre indiquant à quel point deux couleurs semblent différentes. En dessous de 1, la différence est imperceptible.">ΔE</abbr>),
    pour que laque rime avec laque.`,

  "form.make.label": "Marque",
  "form.make.tip": "qu'est-ce que c'est ?",
  "form.make.tipLabel": "À propos du champ Marque",
  "form.make.tipText":
    "Données issues de NHTSA vPIC — une base de données gouvernementale américaine gratuite. Seules certaines marques ont des données de peinture mesurées dans Lacca — cherchez le symbole ●.",
  "form.model.label": "Modèle",
  "form.paint.label": "Couleur extérieure d'usine",
  "form.paint.tipLabel": "À propos du champ de couleur extérieure",
  "form.paint.tipText":
    "Code de peinture officiel et finition. Finitions : unie (plate), métallisée (paillettes), nacrée (brillance mica), multicouche (profondeur), mate (non réfléchissante).",
  "form.submit": "Trouver la couleur de vernis",

  "dropdown.loadingMakes": "Chargement des marques…",
  "dropdown.selectMake": "Sélectionnez une marque…",
  "dropdown.pickMakeFirst": "Choisissez une marque d'abord",
  "dropdown.loadingModels": "Chargement des modèles…",
  "dropdown.selectModel": "Sélectionnez un modèle…",
  "dropdown.pickModelFirst": "Choisissez un modèle d'abord",
  "dropdown.selectColor": "Sélectionnez une couleur…",

  "optgroup.withData": "● Avec données de peinture mesurées",
  "optgroup.allMakes": "Toutes les marques (NHTSA vPIC)",
  "optgroup.allModels": "Tous les modèles (NHTSA)",
  "optgroup.genericColors": "Couleurs automobiles génériques (approximatives)",

  "availability.noData":
    "Aucune donnée de peinture d'usine pour <strong>{make} {model}</strong> pour l'instant — comparaison avec des <strong>couleurs automobiles génériques</strong>. Précision moindre qu'avec un OEM nommé.",

  "results.heading": "Vos correspondances",
  "results.picksSublabel": "Meilleures sélections OPI pour cette peinture",
  "results.distantBanner": "Aucune teinte OPI proche dans ce catalogue — expansion en cours.",
  "results.finishDisclaimer":
    "La peinture métallisée change selon l'angle — le LAB est une moyenne ; utilisez les suggestions comme orientation, pas comme identité.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — distance de couleur perceptuellement uniforme.">ΔE</abbr>
      niveaux
    </strong>
    · Excellent &lt;1 (imperceptible) · Proche 1–2 · Explorer 2–4 (perceptible) · Distant 4+`,

  "tier.perfect": "Excellent",
  "tier.close": "Proche",
  "tier.explore": "Explorer",
  "tier.distant": "Distant",

  "tierTip.perfect": "ΔE inférieur à 1 — visuellement identique pour la plupart des gens.",
  "tierTip.close": "ΔE 1–2 — très bonne correspondance, légère différence.",
  "tierTip.explore": "ΔE 2–4 — différence perceptible, même famille de couleurs.",
  "tierTip.distant": "ΔE 4+ — teinte ou luminosité clairement différente.",

  "conf.measured": "Mesuré",
  "conf.spec": "Selon spec",
  "conf.derivedHex": "Dérivé HEX",
  "conf.derivedChip": "Dérivé puce",
  "conf.derivedOther": "Dérivé (approx.)",
  "conf.estimated": "Estimé",
  "conf.generic": "Palette générique",

  "confTip.measured":
    "Lecture spectrophotométrique sur une puce physique — confiance maximale.",
  "confTip.spec": "D'une fiche technique OEM ou sous licence.",
  "confTip.derivedHex":
    "Converti à partir d'un HEX publié ou d'une référence de retouche.",
  "confTip.derivedChip":
    "Moyenne d'une image de puce PaintRef — un mauvais appariement ligne↔puce fausse la teinte.",
  "confTip.derivedOther":
    "Converti ou déduit d'une source secondaire — pas une mesure spectro directe.",
  "confTip.estimated": "Valeur approximative en attendant une mesure vérifiée.",
  "confTip.generic":
    "Couleur approximative d'une palette universelle dérivée de HEX. Pas une mesure d'usine.",

  "swatch.carTitle":
    "Couleur approximative rendue à partir des valeurs L*a*b* mesurées. L'apparence réelle varie selon l'écran et la finition.",

  "glossary.summary": "Que signifient ΔE, LAB et OPI ?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "Une marque mondiale de vernis à ongles — incontournable en salon depuis 1981. Lacca compare la peinture de votre voiture aux teintes OPI.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `Un seul chiffre indiquant à quel point deux couleurs semblent différentes.
    <strong>&lt;1</strong> imperceptible ·
    <strong>1–2</strong> proche ·
    <strong>2–4</strong> perceptible ·
    <strong>4+</strong> clairement différent.
    Lacca classe avec <strong>CIEDE2000</strong>, qui pondère la luminosité, le chroma et la teinte comme la vision humaine.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `Espace colorimétrique conçu pour correspondre à la perception humaine.
    <strong>L*</strong> = luminosité (0 noir → 100 blanc),
    <strong>a*</strong> = vert↔rouge,
    <strong>b*</strong> = bleu↔jaune.`,
  "glossary.d65.term": "D65 / observateur 2°",
  "glossary.d65.def":
    "Éclairage et angle de vision de référence pour les mesures de couleur — approximativement la lumière du jour à midi, vue de face.",
  "glossary.finish.term": "Finition",
  "glossary.finish.def": `<strong>Unie</strong> — peinture plate uniforme.
    <strong>Métallisée</strong> — paillettes d'aluminium changeant avec la lumière.
    <strong>Nacrée</strong> — pigments de mica avec reflets doux.
    <strong>Multicouche</strong> — plusieurs couches pour profondeur et richesse.
    <strong>Mate</strong> — non réfléchissante.`,
  "glossary.catalog.term": "Catalogue / SKU",
  "glossary.catalog.def":
    "Le SKU est le code produit unique d'un vernis. Le catalogue regroupe de nombreux SKU avec une version et des conditions de mesure partagées.",

  "footer.text": `La liste marques/modèles est extraite en direct de la base de données gratuite
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>.
    Couverture nommée : <strong>Tesla Model 3 / Model Y</strong> et
    <strong>BMW X-line (X1–X7, iX, XM)</strong> pour l'Amérique du Nord, 2020–2026.
    Tous les autres modèles utilisent une <strong>palette générique dérivée HEX</strong>.`,
};

const de: TranslationKeys = {
  "meta.title": "Lacca — Autolackfarbe als Nagellack",
  "meta.description":
    "Ordnen Sie den Außenlack Ihres Autos OPI-Nagellackfarben zu – mit ΔE-Farbwissenschaft.",

  "hero.eyebrow": "Lacca",
  "hero.title": "Die perfekte Ergänzung für Ihr Auto — an Ihren Nägeln",
  "hero.lede": `Wählen Sie Marke, Modell und Werksfarbe Ihres Autos. Lacca ordnet
    <abbr title="OPI ist eine globale Nagellackmarke — Lacca nutzt ihre Farbtöne als Zielbibliothek.">OPI</abbr>-Nagellacke
    nach wahrnehmungsbezogenem Farbabstand
    (<abbr title="Delta-E: eine einzige Zahl dafür, wie unterschiedlich zwei Farben wirken. Unter 1 ist nicht wahrnehmbar.">ΔE</abbr>),
    damit Lack zu Lack passt.`,

  "form.make.label": "Marke",
  "form.make.tip": "Was ist das?",
  "form.make.tipLabel": "Über das Markenfeld",
  "form.make.tipText":
    "Daten von NHTSA vPIC — einer kostenlosen US-Regierungsdatenbank. Nur einige Marken haben gemessene Lackdaten in Lacca — achten Sie auf das ●-Symbol.",
  "form.model.label": "Modell",
  "form.paint.label": "Werkslackfarbe außen",
  "form.paint.tipLabel": "Über das Außenfarbenfeld",
  "form.paint.tipText":
    "Offizieller Lackcode und Oberfläche. Oberflächen: einfarbig (matt), metallic (Flitter), pearl (Glimmer), mehrschichtig (Tiefe), matt (nicht reflektierend).",
  "form.submit": "Nagellackfarbe finden",

  "dropdown.loadingMakes": "Marken werden geladen…",
  "dropdown.selectMake": "Marke auswählen…",
  "dropdown.pickMakeFirst": "Erst Marke auswählen",
  "dropdown.loadingModels": "Modelle werden geladen…",
  "dropdown.selectModel": "Modell auswählen…",
  "dropdown.pickModelFirst": "Erst Modell auswählen",
  "dropdown.selectColor": "Farbe auswählen…",

  "optgroup.withData": "● Mit gemessenen Lackdaten",
  "optgroup.allMakes": "Alle Marken (NHTSA vPIC)",
  "optgroup.allModels": "Alle Modelle (NHTSA)",
  "optgroup.genericColors": "Generische Autofarben (näherungsweise)",

  "availability.noData":
    "Noch keine Werks-Lackdaten für <strong>{make} {model}</strong> — Abgleich mit <strong>generischen Autofarben</strong>. Geringere Genauigkeit als bei einem benannten OEM.",

  "results.heading": "Ihre Treffer",
  "results.picksSublabel": "Beste OPI-Auswahl für diesen Lack",
  "results.distantBanner": "Kein naher OPI-Farbton in diesem Katalog — Erweiterung ausstehend.",
  "results.finishDisclaimer":
    "Metallic-Lack verändert sich mit dem Winkel — LAB ist ein Durchschnitt; Lackvorschläge als Richtung, nicht als Identität verstehen.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — wahrnehmungsgleichmäßiger Farbabstand.">ΔE</abbr>-Stufen
    </strong>
    · Ausgezeichnet &lt;1 (nicht wahrnehmbar) · Nah 1–2 · Erkunden 2–4 (merklich) · Fern 4+`,

  "tier.perfect": "Ausgezeichnet",
  "tier.close": "Nah",
  "tier.explore": "Erkunden",
  "tier.distant": "Fern",

  "tierTip.perfect": "ΔE unter 1 — für die meisten Menschen visuell identisch.",
  "tierTip.close": "ΔE 1–2 — sehr gute Übereinstimmung, subtiler Unterschied.",
  "tierTip.explore": "ΔE 2–4 — merklicher Unterschied, gleiche Farbfamilie.",
  "tierTip.distant": "ΔE 4+ — deutlich unterschiedlicher Farbton oder Helligkeit.",

  "conf.measured": "Gemessen",
  "conf.spec": "Laut Spec",
  "conf.derivedHex": "HEX-abgeleitet",
  "conf.derivedChip": "Chip-abgeleitet",
  "conf.derivedOther": "Abgeleitet (Näherung)",
  "conf.estimated": "Geschätzt",
  "conf.generic": "Generische Palette",

  "confTip.measured":
    "Spektrophotometer-Messung an einem physischen Chip — höchste Verlässlichkeit.",
  "confTip.spec": "Aus einem OEM- oder lizenzierten Lack-Datenblatt.",
  "confTip.derivedHex":
    "Aus einem veröffentlichten oder branchenüblichen Touch-up-HEX umgerechnet.",
  "confTip.derivedChip":
    "Aus einem PaintRef-Chipbild gemittelt — falsche Zeile↔Chip-Zuordnung verfälscht den Farbton.",
  "confTip.derivedOther":
    "Aus einer sekundären Quelle umgerechnet oder abgeleitet — keine direkte Spektro-Messung.",
  "confTip.estimated": "Näherungswert bis eine verifizierte Messung vorliegt.",
  "confTip.generic":
    "Näherungsfarbe aus einer universellen HEX-abgeleiteten Palette. Keine Werksmessung.",

  "swatch.carTitle":
    "Näherungsfarbe aus gemessenen L*a*b*-Werten. Tatsächliches Aussehen variiert je nach Bildschirm und Oberfläche.",

  "glossary.summary": "Was bedeuten ΔE, LAB und OPI?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "Eine globale Nagellackmarke — seit 1981 ein Salonsklassiker. Lacca vergleicht Ihren Autolack mit OPI-Farbtönen.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `Eine einzige Zahl dafür, wie unterschiedlich zwei Farben wirken.
    <strong>&lt;1</strong> nicht wahrnehmbar ·
    <strong>1–2</strong> nah ·
    <strong>2–4</strong> merklich ·
    <strong>4+</strong> deutlich verschieden.
    Lacca sortiert mit <strong>CIEDE2000</strong>, das Helligkeit, Chroma und Farbton so gewichtet, wie das menschliche Auge es tut.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `Farbraum, der die menschliche Farbwahrnehmung nachbildet.
    <strong>L*</strong> = Helligkeit (0 Schwarz → 100 Weiß),
    <strong>a*</strong> = Grün↔Rot,
    <strong>b*</strong> = Blau↔Gelb.`,
  "glossary.d65.term": "D65 / 2°-Beobachter",
  "glossary.d65.def":
    "Referenzbeleuchtung und Betrachtungswinkel für Farbmessungen — ungefähr Tageslicht um Mittag, frontal betrachtet.",
  "glossary.finish.term": "Oberfläche",
  "glossary.finish.def": `<strong>Einfarbig</strong> — gleichmäßig matter Lack.
    <strong>Metallic</strong> — Aluminiumflitter, der sich mit dem Licht verändert.
    <strong>Perleffekt</strong> — Glimmer-Pigmente mit sanftem Schimmer.
    <strong>Mehrschichtig</strong> — mehrere Schichten für Tiefe und Sattheit.
    <strong>Matt</strong> — nicht reflektierend.`,
  "glossary.catalog.term": "Katalog / SKU",
  "glossary.catalog.def":
    "SKU ist der eindeutige Produktcode eines einzelnen Lacks. Der Katalog bündelt viele SKUs mit gemeinsamer Version und Messbedingungen.",

  "footer.text": `Die Marken-/Modellliste wird live aus der kostenlosen
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>-Datenbank abgerufen.
    Benannte Lackabdeckung: <strong>Tesla Model 3 / Model Y</strong> und
    <strong>BMW X-line (X1–X7, iX, XM)</strong> für Nordamerika, 2020–2026.
    Alle anderen Modelle nutzen eine <strong>generische HEX-abgeleitete Palette</strong>.`,
};

const it: TranslationKeys = {
  "meta.title": "Lacca — Colore vernice auto in smalto per unghie",
  "meta.description":
    "Abbina la vernice esterna della tua auto ai colori dello smalto OPI con la scienza del colore ΔE.",

  "hero.eyebrow": "Lacca",
  "hero.title": "Il match perfetto per la tua auto — sulle tue unghie",
  "hero.lede": `Scegli marca, modello e colore di fabbrica della tua auto. Lacca classifica gli smalti
    <abbr title="OPI è un marchio globale di smalti — Lacca usa le sue tonalità come libreria di riferimento.">OPI</abbr>
    in base alla distanza cromatica percettiva
    (<abbr title="Delta-E: un numero unico che indica quanto due colori appaiono diversi. Sotto 1 è impercettibile.">ΔE</abbr>),
    così la lacca incontra la lacca.`,

  "form.make.label": "Marca",
  "form.make.tip": "cos'è questo?",
  "form.make.tipLabel": "Informazioni sul campo Marca",
  "form.make.tipText":
    "Dati da NHTSA vPIC — un database gratuito del governo USA. Solo alcune marche hanno dati di vernice misurati in Lacca — cerca il simbolo ●.",
  "form.model.label": "Modello",
  "form.paint.label": "Colore esterno di fabbrica",
  "form.paint.tipLabel": "Informazioni sul campo colore esterno",
  "form.paint.tipText":
    "Codice vernice ufficiale e finitura. Finiture: solido (piatto), metallizzato (scaglie), madreperlato (shimmer mica), multistrato (profondità), opaco (non riflettente).",
  "form.submit": "Trova il colore dello smalto",

  "dropdown.loadingMakes": "Caricamento marche…",
  "dropdown.selectMake": "Seleziona una marca…",
  "dropdown.pickMakeFirst": "Scegli prima una marca",
  "dropdown.loadingModels": "Caricamento modelli…",
  "dropdown.selectModel": "Seleziona un modello…",
  "dropdown.pickModelFirst": "Scegli prima un modello",
  "dropdown.selectColor": "Seleziona un colore…",

  "optgroup.withData": "● Con dati vernice misurati",
  "optgroup.allMakes": "Tutte le marche (NHTSA vPIC)",
  "optgroup.allModels": "Tutti i modelli (NHTSA)",
  "optgroup.genericColors": "Colori auto generici (approssimativi)",

  "availability.noData":
    "Nessun dato di vernice di fabbrica per <strong>{make} {model}</strong> — confronto con <strong>colori auto generici</strong>. Precisione inferiore rispetto a un OEM nominato.",

  "results.heading": "I tuoi abbinamenti",
  "results.picksSublabel": "Le migliori scelte OPI per questa vernice",
  "results.distantBanner":
    "Nessuna tonalità OPI vicina in questo catalogo — espansione in attesa.",
  "results.finishDisclaimer":
    "La vernice metallizzata cambia con l'angolo — il LAB è una media; considera i suggerimenti come direzione, non identità.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — distanza cromatica percettivamente uniforme.">ΔE</abbr>
      livelli
    </strong>
    · Eccellente &lt;1 (impercettibile) · Vicino 1–2 · Esplorare 2–4 (notevole) · Distante 4+`,

  "tier.perfect": "Eccellente",
  "tier.close": "Vicino",
  "tier.explore": "Esplorare",
  "tier.distant": "Distante",

  "tierTip.perfect": "ΔE sotto 1 — visivamente identico per la maggior parte delle persone.",
  "tierTip.close": "ΔE 1–2 — ottima corrispondenza, differenza sottile.",
  "tierTip.explore": "ΔE 2–4 — differenza notevole, stessa famiglia cromatica.",
  "tierTip.distant": "ΔE 4+ — tonalità o luminosità chiaramente diverse.",

  "conf.measured": "Misurato",
  "conf.spec": "Da specifica",
  "conf.derivedHex": "Derivato HEX",
  "conf.derivedChip": "Derivato da chip",
  "conf.derivedOther": "Derivato (appross.)",
  "conf.estimated": "Stimato",
  "conf.generic": "Palette generica",

  "confTip.measured":
    "Lettura spettrofotometrica su un campione fisico — massima affidabilità.",
  "confTip.spec": "Da una scheda tecnica OEM o con licenza.",
  "confTip.derivedHex":
    "Convertito da un HEX pubblicato o da una referenza di ritocco.",
  "confTip.derivedChip":
    "Media da un'immagine chip PaintRef — accoppiamento riga↔chip errato altera la tonalità.",
  "confTip.derivedOther":
    "Convertito o dedotto da una fonte secondaria — non una misura spettro diretta.",
  "confTip.estimated": "Valore approssimativo fino a quando non sarà disponibile una misurazione verificata.",
  "confTip.generic":
    "Colore approssimativo da una palette universale derivata da HEX. Non è una misurazione di fabbrica.",

  "swatch.carTitle":
    "Colore approssimativo dai valori L*a*b* misurati. L'aspetto reale varia a seconda dello schermo e della finitura.",

  "glossary.summary": "Cosa significano ΔE, LAB e OPI?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "Un marchio globale di smalti — un classico dei saloni dal 1981. Lacca confronta la vernice della tua auto con le tonalità OPI.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `Un numero unico che indica quanto due colori appaiono diversi.
    <strong>&lt;1</strong> impercettibile ·
    <strong>1–2</strong> vicino ·
    <strong>2–4</strong> notevole ·
    <strong>4+</strong> chiaramente diverso.
    Lacca classifica con <strong>CIEDE2000</strong>, che pesa luminosità, croma e tonalità come fa la visione umana.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `Spazio cromatico progettato per corrispondere alla percezione umana.
    <strong>L*</strong> = luminosità (0 nero → 100 bianco),
    <strong>a*</strong> = verde↔rosso,
    <strong>b*</strong> = blu↔giallo.`,
  "glossary.d65.term": "D65 / osservatore 2°",
  "glossary.d65.def":
    "Illuminazione e angolo di visione di riferimento per le misurazioni del colore — approssimativamente luce del giorno a mezzogiorno, vista frontalmente.",
  "glossary.finish.term": "Finitura",
  "glossary.finish.def": `<strong>Solido</strong> — vernice piatta uniforme.
    <strong>Metallizzato</strong> — scaglie di alluminio che cambiano con la luce.
    <strong>Madreperlato</strong> — pigmenti mica con lucentezza soffusa.
    <strong>Multistrato</strong> — diversi strati per profondità e ricchezza.
    <strong>Opaco</strong> — non riflettente.`,
  "glossary.catalog.term": "Catalogo / SKU",
  "glossary.catalog.def":
    "Lo SKU è il codice prodotto univoco di un singolo smalto. Il catalogo raggruppa molti SKU con versione e condizioni di misurazione condivise.",

  "footer.text": `La lista marche/modelli è ottenuta in tempo reale dal database gratuito
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>.
    Copertura nominata: <strong>Tesla Model 3 / Model Y</strong> e
    <strong>BMW X-line (X1–X7, iX, XM)</strong> per il Nord America, 2020–2026.
    Tutti gli altri modelli usano una <strong>palette generica derivata da HEX</strong>.`,
};

const pt: TranslationKeys = {
  "meta.title": "Lacca — Cor de pintura do carro em esmalte de unhas",
  "meta.description":
    "Combine a pintura exterior do seu carro com as cores de esmalte OPI usando a ciência de cores ΔE.",

  "hero.eyebrow": "Lacca",
  "hero.title": "A combinação perfeita para o seu carro — nas suas unhas",
  "hero.lede": `Escolha a marca, modelo e cor de fábrica do seu carro. Lacca classifica os esmaltes
    <abbr title="OPI é uma marca global de esmaltes — Lacca usa seus tons como biblioteca alvo.">OPI</abbr>
    pela distância de cor perceptual
    (<abbr title="Delta-E: um único número para o quão diferentes duas cores parecem. Abaixo de 1 é imperceptível.">ΔE</abbr>),
    para que verniz combine com verniz.`,

  "form.make.label": "Marca",
  "form.make.tip": "o que é isso?",
  "form.make.tipLabel": "Sobre o campo Marca",
  "form.make.tipText":
    "Dados do NHTSA vPIC — um banco de dados governamental americano gratuito. Apenas algumas marcas têm dados de pintura medidos no Lacca — procure o símbolo ●.",
  "form.model.label": "Modelo",
  "form.paint.label": "Cor exterior de fábrica",
  "form.paint.tipLabel": "Sobre o campo de cor exterior",
  "form.paint.tipText":
    "Código de pintura oficial e acabamento. Acabamentos: sólido (plano), metálico (escamas), perolado (shimmer mica), multicamadas (profundidade), fosco (não reflexivo).",
  "form.submit": "Encontrar cor de esmalte",

  "dropdown.loadingMakes": "Carregando marcas…",
  "dropdown.selectMake": "Selecione uma marca…",
  "dropdown.pickMakeFirst": "Escolha uma marca primeiro",
  "dropdown.loadingModels": "Carregando modelos…",
  "dropdown.selectModel": "Selecione um modelo…",
  "dropdown.pickModelFirst": "Escolha um modelo primeiro",
  "dropdown.selectColor": "Selecione uma cor…",

  "optgroup.withData": "● Com dados de pintura medidos",
  "optgroup.allMakes": "Todas as marcas (NHTSA vPIC)",
  "optgroup.allModels": "Todos os modelos (NHTSA)",
  "optgroup.genericColors": "Cores automotivas genéricas (aproximadas)",

  "availability.noData":
    "Sem dados de pintura de fábrica para <strong>{make} {model}</strong> ainda — comparando com <strong>cores automotivas genéricas</strong>. Precisão menor do que com um OEM nomeado.",

  "results.heading": "Suas combinações",
  "results.picksSublabel": "Melhores opções OPI para esta pintura",
  "results.distantBanner":
    "Nenhum tom OPI próximo neste catálogo ainda — expansão pendente.",
  "results.finishDisclaimer":
    "Pintura metálica muda com o ângulo — LAB é uma média; use as sugestões como direção, não identidade.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — distância de cor perceptualmente uniforme.">ΔE</abbr>
      níveis
    </strong>
    · Excelente &lt;1 (imperceptível) · Próximo 1–2 · Explorar 2–4 (notável) · Distante 4+`,

  "tier.perfect": "Excelente",
  "tier.close": "Próximo",
  "tier.explore": "Explorar",
  "tier.distant": "Distante",

  "tierTip.perfect": "ΔE abaixo de 1 — visualmente idêntico para a maioria das pessoas.",
  "tierTip.close": "ΔE 1–2 — muito boa combinação, diferença sutil.",
  "tierTip.explore": "ΔE 2–4 — diferença notável, mesma família de cores.",
  "tierTip.distant": "ΔE 4+ — tom ou luminosidade claramente diferentes.",

  "conf.measured": "Medido",
  "conf.spec": "Da especificação",
  "conf.derivedHex": "Derivado HEX",
  "conf.derivedChip": "Derivado do chip",
  "conf.derivedOther": "Derivado (aprox.)",
  "conf.estimated": "Estimado",
  "conf.generic": "Paleta genérica",

  "confTip.measured":
    "Leitura espectrofotométrica em uma amostra física — maior confiança.",
  "confTip.spec": "De uma ficha técnica OEM ou licenciada.",
  "confTip.derivedHex":
    "Convertido de um HEX publicado ou de referência de retoque.",
  "confTip.derivedChip":
    "Média de uma imagem de chip PaintRef — pareamento linha↔chip errado distorce o matiz.",
  "confTip.derivedOther":
    "Convertido ou inferido de uma fonte secundária — não é medição espectro direta.",
  "confTip.estimated": "Valor aproximado até que uma medição verificada esteja disponível.",
  "confTip.generic":
    "Cor aproximada de uma paleta universal derivada de HEX. Não é uma medição de fábrica.",

  "swatch.carTitle":
    "Cor aproximada renderizada a partir de valores L*a*b* medidos. A aparência real varia conforme a tela e o acabamento.",

  "glossary.summary": "O que significam ΔE, LAB e OPI?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "Uma marca global de esmaltes — um clássico de salões desde 1981. Lacca compara a pintura do seu carro com os tons OPI.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `Um único número para o quão diferentes duas cores parecem.
    <strong>&lt;1</strong> imperceptível ·
    <strong>1–2</strong> próximo ·
    <strong>2–4</strong> notável ·
    <strong>4+</strong> claramente diferente.
    Lacca classifica com <strong>CIEDE2000</strong>, que pondera luminosidade, croma e tom como a visão humana.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `Espaço de cor projetado para corresponder à percepção humana.
    <strong>L*</strong> = luminosidade (0 preto → 100 branco),
    <strong>a*</strong> = verde↔vermelho,
    <strong>b*</strong> = azul↔amarelo.`,
  "glossary.d65.term": "D65 / observador 2°",
  "glossary.d65.def":
    "Iluminação e ângulo de visão de referência para medições de cor — aproximadamente luz diurna ao meio-dia, visto de frente.",
  "glossary.finish.term": "Acabamento",
  "glossary.finish.def": `<strong>Sólido</strong> — pintura plana uniforme.
    <strong>Metálico</strong> — escamas de alumínio que mudam com a luz.
    <strong>Perolado</strong> — pigmentos mica com brilho suave.
    <strong>Multicamadas</strong> — várias camadas para profundidade e riqueza.
    <strong>Fosco</strong> — não reflexivo.`,
  "glossary.catalog.term": "Catálogo / SKU",
  "glossary.catalog.def":
    "SKU é o código de produto único de um único esmalte. O catálogo agrupa muitos SKUs com versão e condições de medição compartilhadas.",

  "footer.text": `A lista de marcas/modelos é obtida em tempo real do banco de dados gratuito
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>.
    Cobertura nomeada: <strong>Tesla Model 3 / Model Y</strong> e
    <strong>BMW X-line (X1–X7, iX, XM)</strong> para a América do Norte, 2020–2026.
    Todos os outros modelos usam uma <strong>paleta genérica derivada de HEX</strong>.`,
};

const ja: TranslationKeys = {
  "meta.title": "Lacca — 車のペイントカラーをネイルカラーに",
  "meta.description":
    "ΔEカラーサイエンスを使って、愛車の外装色にぴったりのOPIネイルカラーを見つけましょう。",

  "hero.eyebrow": "Lacca",
  "hero.title": "あなたの愛車にぴったり — 爪先にも",
  "hero.lede": `車のメーカー・モデル・純正カラーを選ぶと、Laccaが
    <abbr title="OPIはグローバルなネイルポリッシュブランドです。LaccaはOPIのシェードをマッチング対象のライブラリとして使用しています。">OPI</abbr>
    のネイルカラーを知覚的色差
    (<abbr title="Delta-E：2つの色がどれだけ違って見えるかを表す1つの数値。1未満は識別不可能。">ΔE</abbr>)
    でランク付けします。ラッカーにはラッカーを。`,

  "form.make.label": "メーカー",
  "form.make.tip": "これは何？",
  "form.make.tipLabel": "メーカーフィールドについて",
  "form.make.tipText":
    "NHTSA vPIC（米国政府の無料車両データベース）から取得しています。Laccaで測定済みペイントデータがあるメーカーは一部のみです — ●マークをご確認ください。",
  "form.model.label": "モデル",
  "form.paint.label": "純正外装カラー",
  "form.paint.tipLabel": "外装カラーフィールドについて",
  "form.paint.tipText":
    "公式のペイントコードと仕上げ。仕上げ：ソリッド（マット）、メタリック（フレーク）、パール（マイカシマー）、マルチコート（奥行き）、マット（非反射）。",
  "form.submit": "ネイルカラーを探す",

  "dropdown.loadingMakes": "メーカーを読み込み中…",
  "dropdown.selectMake": "メーカーを選択…",
  "dropdown.pickMakeFirst": "先にメーカーを選択",
  "dropdown.loadingModels": "モデルを読み込み中…",
  "dropdown.selectModel": "モデルを選択…",
  "dropdown.pickModelFirst": "先にモデルを選択",
  "dropdown.selectColor": "カラーを選択…",

  "optgroup.withData": "● 測定済みペイントデータあり",
  "optgroup.allMakes": "全メーカー (NHTSA vPIC)",
  "optgroup.allModels": "全モデル (NHTSA)",
  "optgroup.genericColors": "汎用自動車カラー（近似値）",

  "availability.noData":
    "<strong>{make} {model}</strong> の純正ペイントデータはまだありません — <strong>汎用自動車カラー</strong>でマッチングします。名称OEMより精度が低くなります。",

  "results.heading": "マッチ結果",
  "results.picksSublabel": "このペイントのOPIおすすめ",
  "results.distantBanner": "このカタログには近いOPIカラーがありません — 拡張予定。",
  "results.finishDisclaimer":
    "メタリックペイントは角度によって変わります — LABは平均値です。提案は方向性の参考としてください。",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — 知覚的に均一な色差。">ΔE</abbr>
      ティア
    </strong>
    · 優秀 &lt;1（識別不可） · 近い 1–2 · 探索 2–4（目立つ差） · 遠い 4+`,

  "tier.perfect": "優秀",
  "tier.close": "近い",
  "tier.explore": "探索",
  "tier.distant": "遠い",

  "tierTip.perfect": "ΔE 1未満 — ほとんどの人には視覚的に同じに見えます。",
  "tierTip.close": "ΔE 1–2 — 非常に近いマッチ、わずかな差。",
  "tierTip.explore": "ΔE 2–4 — 目立つ差だが、同じカラーファミリー。",
  "tierTip.distant": "ΔE 4+ — 明らかに異なる色調または明るさ。",

  "conf.measured": "実測値",
  "conf.spec": "仕様書から",
  "conf.derivedHex": "HEX変換",
  "conf.derivedChip": "チップ由来",
  "conf.derivedOther": "換算（近似）",
  "conf.estimated": "推定値",
  "conf.generic": "汎用パレット",

  "confTip.measured": "物理チップの分光光度計測定 — 最高精度。",
  "confTip.spec": "OEMまたはライセンスペイント仕様書から。",
  "confTip.derivedHex": "公開または業界タッチアップ用HEXから換算。",
  "confTip.derivedChip":
    "PaintRefチップ画像の平均 — 行とチップの取り違えで色相が大きくずれることがあります。",
  "confTip.derivedOther": "二次ソースからの換算・推定 — 分光計の直接測定ではありません。",
  "confTip.estimated": "検証済み測定値が利用可能になるまでの近似値。",
  "confTip.generic":
    "HEX変換の汎用パレットからの近似色。純正測定値ではありません。",

  "swatch.carTitle":
    "測定されたL*a*b*値から生成した近似色。実際の見た目はディスプレイや仕上げにより異なります。",

  "glossary.summary": "ΔE、LAB、OPIとは？",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "1981年からサロンの定番となっているグローバルなネイルポリッシュブランド。Laccaは車のペイントをOPIのカラーと比較します。",
  "glossary.deltaE.term": "ΔE（デルタE、CIEDE2000）",
  "glossary.deltaE.def": `2つの色がどれだけ違って見えるかを表す1つの数値。
    <strong>&lt;1</strong> 識別不可 ·
    <strong>1–2</strong> 近い ·
    <strong>2–4</strong> 目立つ ·
    <strong>4+</strong> 明らかに異なる。
    LaccaはCIEDE2000で分類します。これは人間の視覚に近い方法で明度・彩度・色相を重み付けします。`,
  "glossary.lab.term": "L*a*b*（CIELAB）",
  "glossary.lab.def": `人間の色知覚に合わせた色空間。
    <strong>L*</strong> = 明度（0黒 → 100白）、
    <strong>a*</strong> = 緑↔赤、
    <strong>b*</strong> = 青↔黄。`,
  "glossary.d65.term": "D65 / 2度視野",
  "glossary.d65.def":
    "色測定の基準照明と視野角 — 正午の昼光、正面から見た場合に相当します。同一条件で測定した色のみ比較可能です。",
  "glossary.finish.term": "仕上げ",
  "glossary.finish.def": `<strong>ソリッド</strong> — 均一なフラットペイント。
    <strong>メタリック</strong> — 光で変化するアルミフレーク。
    <strong>パール</strong> — マイカ顔料のやわらかい輝き。
    <strong>マルチコート</strong> — 深みと豊かさのための複数層（テスラ特徴）。
    <strong>マット</strong> — 非反射。`,
  "glossary.catalog.term": "カタログ / SKU",
  "glossary.catalog.def":
    "SKUは1つのポリッシュの固有製品コードです。カタログは同じバージョン・測定条件の多数のSKUをまとめたものです。",

  "footer.text": `メーカー/モデルリストは無料の
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>
    データベースからリアルタイムで取得しています。
    測定済みペイント対応: <strong>Tesla Model 3 / Model Y</strong> および
    <strong>BMW X-line (X1–X7, iX, XM)</strong>（北米、2020–2026年）。
    その他すべてのモデルは<strong>汎用HEX変換パレット</strong>を使用します。`,
};

const zh: TranslationKeys = {
  "meta.title": "Lacca — 汽车漆色与美甲颜色匹配",
  "meta.description": "使用ΔE色彩科学，将您爱车的外观漆色与OPI指甲油颜色精准匹配。",

  "hero.eyebrow": "Lacca",
  "hero.title": "为您的爱车找到完美搭配 — 就在您的指尖",
  "hero.lede": `选择您汽车的品牌、型号和原厂颜色，Lacca会根据感知色差
    (<abbr title="Delta-E：衡量两种颜色视觉差异的单一数值，小于1为不可察觉。">ΔE</abbr>)
    对
    <abbr title="OPI是一个全球美甲品牌 — Lacca以其色系作为匹配目标库。">OPI</abbr>
    指甲油色系进行排名，以油漆匹配指甲油。`,

  "form.make.label": "品牌",
  "form.make.tip": "这是什么？",
  "form.make.tipLabel": "关于品牌字段",
  "form.make.tipText":
    "数据来自NHTSA vPIC — 美国政府免费车辆数据库。目前Lacca中只有部分品牌有测量漆色数据 — 请查找●标志。",
  "form.model.label": "型号",
  "form.paint.label": "原厂外观颜色",
  "form.paint.tipLabel": "关于外观颜色字段",
  "form.paint.tipText":
    "官方漆色代码和漆面类型。漆面类型：素色（平光）、金属漆（铝片）、珍珠漆（云母闪光）、多涂层（深度感）、哑光（无反射）。",
  "form.submit": "查找指甲油颜色",

  "dropdown.loadingMakes": "正在加载品牌…",
  "dropdown.selectMake": "选择品牌…",
  "dropdown.pickMakeFirst": "请先选择品牌",
  "dropdown.loadingModels": "正在加载型号…",
  "dropdown.selectModel": "选择型号…",
  "dropdown.pickModelFirst": "请先选择型号",
  "dropdown.selectColor": "选择颜色…",

  "optgroup.withData": "● 含测量漆色数据",
  "optgroup.allMakes": "所有品牌（NHTSA vPIC）",
  "optgroup.allModels": "所有型号（NHTSA）",
  "optgroup.genericColors": "通用汽车颜色（近似值）",

  "availability.noData":
    "暂无 <strong>{make} {model}</strong> 的原厂漆色数据 — 将以<strong>通用汽车颜色</strong>进行匹配。准确度低于已命名OEM。",

  "results.heading": "您的匹配结果",
  "results.picksSublabel": "该漆色的OPI推荐",
  "results.distantBanner": "此目录中暂无接近的OPI色号 — 扩展待定。",
  "results.finishDisclaimer":
    "金属漆会随角度变化 — LAB值为平均值；请将指甲油建议作为参考方向，而非精确匹配。",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — 感知均匀色差。">ΔE</abbr>
      等级
    </strong>
    · 优秀 &lt;1（不可察觉）· 接近 1–2 · 探索 2–4（明显差异）· 差距大 4+`,

  "tier.perfect": "优秀",
  "tier.close": "接近",
  "tier.explore": "探索",
  "tier.distant": "差距大",

  "tierTip.perfect": "ΔE小于1 — 对大多数人来说视觉上完全相同。",
  "tierTip.close": "ΔE 1–2 — 非常接近的匹配，细微差异。",
  "tierTip.explore": "ΔE 2–4 — 明显差异，同一颜色系列。",
  "tierTip.distant": "ΔE 4+ — 色调或亮度明显不同。",

  "conf.measured": "已测量",
  "conf.spec": "来自规格",
  "conf.derivedHex": "HEX转换",
  "conf.derivedChip": "色片推算",
  "conf.derivedOther": "换算（近似）",
  "conf.estimated": "估算值",
  "conf.generic": "通用调色板",

  "confTip.measured": "物理色片的分光光度计读数 — 最高置信度。",
  "confTip.spec": "来自OEM或授权漆色规格表。",
  "confTip.derivedHex": "由公开或行业补漆用HEX换算。",
  "confTip.derivedChip":
    "来自PaintRef色片图像的平均 — 行与色片对错会严重偏色。",
  "confTip.derivedOther": "由次级来源换算或推断 — 非分光计直接测量。",
  "confTip.estimated": "在验证测量值可用之前的近似值。",
  "confTip.generic": "来自HEX转换通用调色板的近似颜色。非原厂测量值。",

  "swatch.carTitle":
    "根据测量的L*a*b*值渲染的近似颜色。实际外观因屏幕和漆面类型而异。",

  "glossary.summary": "ΔE、LAB和OPI是什么意思？",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "全球知名美甲品牌 — 自1981年起成为沙龙必备。Lacca将您的汽车漆色与OPI色号进行比较。",
  "glossary.deltaE.term": "ΔE（Delta-E，CIEDE2000）",
  "glossary.deltaE.def": `衡量两种颜色视觉差异的单一数值。
    <strong>&lt;1</strong> 不可察觉 ·
    <strong>1–2</strong> 接近 ·
    <strong>2–4</strong> 明显 ·
    <strong>4+</strong> 明显不同。
    Lacca使用<strong>CIEDE2000</strong>排序，按人眼感知方式加权亮度、彩度和色相。`,
  "glossary.lab.term": "L*a*b*（CIELAB）",
  "glossary.lab.def": `专为匹配人类色彩感知而设计的色彩空间。
    <strong>L*</strong> = 亮度（0黑色 → 100白色），
    <strong>a*</strong> = 绿↔红，
    <strong>b*</strong> = 蓝↔黄。`,
  "glossary.d65.term": "D65 / 2度视场",
  "glossary.d65.def":
    "颜色测量的参考光源和观察角度 — 相当于正午日光，正视角度。只有在相同条件下测量的颜色才能相互比较。",
  "glossary.finish.term": "漆面类型",
  "glossary.finish.def": `<strong>素色</strong> — 均匀平光漆。
    <strong>金属漆</strong> — 随光线变化的铝片。
    <strong>珍珠漆</strong> — 带有柔和光泽的云母颜料。
    <strong>多涂层</strong> — 多层叠加增加深度和丰富感（特斯拉特色）。
    <strong>哑光</strong> — 无反射。`,
  "glossary.catalog.term": "目录 / SKU",
  "glossary.catalog.def":
    "SKU是单款指甲油的唯一产品代码。目录将共享版本和测量条件的多个SKU组合在一起。",

  "footer.text": `品牌/型号列表实时从免费的
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>
    车辆数据库获取。已命名漆色覆盖：<strong>Tesla Model 3 / Model Y</strong> 和
    <strong>BMW X-line（X1–X7, iX, XM）</strong>（北美地区，2020–2026年）。
    所有其他型号使用<strong>通用HEX转换调色板</strong>。`,
};

const ko: TranslationKeys = {
  "meta.title": "Lacca — 자동차 페인트 색상과 네일 컬러 매칭",
  "meta.description":
    "ΔE 색채 과학을 사용하여 자동차의 외장 색상에 맞는 OPI 네일 폴리시 색상을 찾아보세요.",

  "hero.eyebrow": "Lacca",
  "hero.title": "내 차를 위한 완벽한 매칭 — 손끝에서",
  "hero.lede": `자동차의 제조사, 모델, 순정 색상을 선택하세요. Lacca가
    <abbr title="OPI는 글로벌 네일 폴리시 브랜드입니다 — Lacca는 OPI 쉐이드를 매칭 라이브러리로 사용합니다.">OPI</abbr>
    네일 폴리시를 지각적 색차
    (<abbr title="Delta-E: 두 색상이 얼마나 달라 보이는지를 나타내는 단일 수치. 1 미만은 식별 불가능.">ΔE</abbr>)
    로 순위를 매겨, 래커가 래커와 만날 수 있도록 합니다.`,

  "form.make.label": "제조사",
  "form.make.tip": "이게 뭔가요?",
  "form.make.tipLabel": "제조사 필드 정보",
  "form.make.tipText":
    "NHTSA vPIC(미국 정부 무료 차량 데이터베이스)에서 가져옵니다. Lacca에서 실측 페인트 데이터가 있는 제조사는 일부에 불과합니다 — ● 표시를 확인하세요.",
  "form.model.label": "모델",
  "form.paint.label": "순정 외장 색상",
  "form.paint.tipLabel": "외장 색상 필드 정보",
  "form.paint.tipText":
    "공식 페인트 코드와 마감. 마감 종류: 솔리드(무광), 메탈릭(플레이크), 펄(마이카 광택), 멀티코트(깊이감), 매트(무반사).",
  "form.submit": "네일 색상 찾기",

  "dropdown.loadingMakes": "제조사 불러오는 중…",
  "dropdown.selectMake": "제조사 선택…",
  "dropdown.pickMakeFirst": "먼저 제조사를 선택하세요",
  "dropdown.loadingModels": "모델 불러오는 중…",
  "dropdown.selectModel": "모델 선택…",
  "dropdown.pickModelFirst": "먼저 모델을 선택하세요",
  "dropdown.selectColor": "색상 선택…",

  "optgroup.withData": "● 실측 페인트 데이터 있음",
  "optgroup.allMakes": "모든 제조사 (NHTSA vPIC)",
  "optgroup.allModels": "모든 모델 (NHTSA)",
  "optgroup.genericColors": "범용 자동차 색상 (근사치)",

  "availability.noData":
    "<strong>{make} {model}</strong>의 순정 페인트 데이터가 아직 없습니다 — <strong>범용 자동차 색상</strong>으로 매칭합니다. 지정 OEM보다 정확도가 낮을 수 있습니다.",

  "results.heading": "매칭 결과",
  "results.picksSublabel": "이 페인트를 위한 OPI 추천",
  "results.distantBanner": "이 카탈로그에는 가까운 OPI 색상이 없습니다 — 확장 예정.",
  "results.finishDisclaimer":
    "메탈릭 페인트는 각도에 따라 달라집니다 — LAB는 평균값입니다. 폴리시 추천은 방향성 참고로 활용하세요.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — 지각적으로 균일한 색차.">ΔE</abbr>
      등급
    </strong>
    · 우수 &lt;1 (식별 불가) · 가까움 1–2 · 탐색 2–4 (눈에 띄는 차이) · 멂 4+`,

  "tier.perfect": "우수",
  "tier.close": "가까움",
  "tier.explore": "탐색",
  "tier.distant": "멂",

  "tierTip.perfect": "ΔE 1 미만 — 대부분의 사람들에게 시각적으로 동일합니다.",
  "tierTip.close": "ΔE 1–2 — 매우 가까운 매칭, 미묘한 차이.",
  "tierTip.explore": "ΔE 2–4 — 눈에 띄는 차이, 같은 색상 계열.",
  "tierTip.distant": "ΔE 4+ — 색조 또는 밝기가 명확히 다름.",

  "conf.measured": "실측",
  "conf.spec": "스펙 기반",
  "conf.derivedHex": "HEX 변환",
  "conf.derivedChip": "칩 기반",
  "conf.derivedOther": "환산(근사)",
  "conf.estimated": "추정값",
  "conf.generic": "범용 팔레트",

  "confTip.measured": "물리적 칩 분광광도계 측정 — 최고 신뢰도.",
  "confTip.spec": "OEM 또는 라이선스 페인트 사양서에서.",
  "confTip.derivedHex": "공개 또는 업계 터치업 HEX에서 환산.",
  "confTip.derivedChip":
    "PaintRef 칩 이미지 평균 — 행↔칩 매칭 오류 시 색상이 크게 어긋날 수 있습니다.",
  "confTip.derivedOther": "2차 출처에서 환산·추정 — 분광계 직접 측정이 아닙니다.",
  "confTip.estimated": "검증된 측정값이 제공될 때까지의 근사값.",
  "confTip.generic":
    "HEX 변환 범용 팔레트의 근사 색상. 공장 측정값이 아닙니다.",

  "swatch.carTitle":
    "측정된 L*a*b* 값으로 렌더링된 근사 색상. 실제 외관은 화면과 마감에 따라 다릅니다.",

  "glossary.summary": "ΔE, LAB, OPI는 무엇인가요?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "1981년부터 살롱의 필수 아이템인 글로벌 네일 폴리시 브랜드. Lacca는 자동차 페인트를 OPI 색상과 비교합니다.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `두 색상이 얼마나 달라 보이는지를 나타내는 단일 수치.
    <strong>&lt;1</strong> 식별 불가 ·
    <strong>1–2</strong> 가까움 ·
    <strong>2–4</strong> 눈에 띔 ·
    <strong>4+</strong> 명확히 다름.
    Lacca는 인간의 시각처럼 밝기, 채도, 색조를 가중치로 적용하는 <strong>CIEDE2000</strong>으로 순위를 매깁니다.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `인간의 색 인식에 맞게 설계된 색 공간.
    <strong>L*</strong> = 밝기 (0 검정 → 100 흰색),
    <strong>a*</strong> = 초록↔빨강,
    <strong>b*</strong> = 파랑↔노랑.`,
  "glossary.d65.term": "D65 / 2도 관찰자",
  "glossary.d65.def":
    "색 측정을 위한 기준 조명과 관찰 각도 — 정오의 주광, 정면에서 본 것에 해당합니다. 동일한 조건에서 측정된 색상끼리만 비교 가능합니다.",
  "glossary.finish.term": "마감",
  "glossary.finish.def": `<strong>솔리드</strong> — 균일한 무광 페인트.
    <strong>메탈릭</strong> — 빛에 따라 변하는 알루미늄 플레이크.
    <strong>펄</strong> — 부드러운 광택의 마이카 안료.
    <strong>멀티코트</strong> — 깊이와 풍부함을 위한 여러 층 (테슬라 특성).
    <strong>매트</strong> — 무반사.`,
  "glossary.catalog.term": "카탈로그 / SKU",
  "glossary.catalog.def":
    "SKU는 단일 폴리시의 고유 제품 코드입니다. 카탈로그는 공유 버전과 측정 조건을 가진 여러 SKU를 그룹화합니다.",

  "footer.text": `제조사/모델 목록은 무료
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>
    차량 데이터베이스에서 실시간으로 가져옵니다.
    지정 페인트 지원: <strong>Tesla Model 3 / Model Y</strong> 및
    <strong>BMW X-line (X1–X7, iX, XM)</strong> (북미, 2020–2026).
    기타 모든 모델은 <strong>범용 HEX 변환 팔레트</strong>를 사용합니다.`,
};

const he: TranslationKeys = {
  ...en,
  "meta.title": "Lacca — התאמת צבע רכב ללק",
  "meta.description": "התאימו את צבע הרכב שלכם לגווני OPI בעזרת מדד ΔE.",

  "hero.title": "ההתאמה המושלמת לרכב שלך — ועל הציפורניים שלך",
  "hero.lede": `בחרו יצרן, דגם וצבע מקורי של הרכב. Lacca מדרגת גווני
    <abbr title="OPI הוא מותג לקים עולמי — Lacca משתמשת בגוונים שלו כספריית היעד.">OPI</abbr>
    לפי מרחק צבע תפיסתי
    (<abbr title="Delta-E: מספר יחיד שמייצג עד כמה שני צבעים נראים שונים. מתחת ל-1 ההבדל כמעט לא מורגש.">ΔE</abbr>),
    כך שלק פוגש לק.`,

  "form.make.label": "יצרן",
  "form.make.tip": "מה זה?",
  "form.make.tipLabel": "מידע על שדה היצרן",
  "form.make.tipText":
    "הנתונים מגיעים מ-NHTSA vPIC — מאגר רכבים ציבורי וחינמי של ממשלת ארה״ב. רק לחלק מהיצרנים קיימים כרגע ב-Lacca נתוני צבע מדודים — חפשו את הסימון ●.",
  "form.model.label": "דגם",
  "form.paint.label": "צבע חוץ מקורי",
  "form.paint.tipLabel": "מידע על שדה צבע החוץ",
  "form.paint.tipText":
    "קוד צבע רשמי וסוג גימור. סוגי גימור: סולידי (אחיד), מטאלי (פתיתים), פנינה (ברק מיקה), רב-שכבתי (עומק), מט (לא מחזיר אור).",
  "form.submit": "מצאו צבע לק",

  "dropdown.loadingMakes": "טוען יצרנים…",
  "dropdown.selectMake": "בחרו יצרן…",
  "dropdown.pickMakeFirst": "בחרו קודם יצרן",
  "dropdown.loadingModels": "טוען דגמים…",
  "dropdown.selectModel": "בחרו דגם…",
  "dropdown.pickModelFirst": "בחרו קודם דגם",
  "dropdown.selectColor": "בחרו צבע…",

  "optgroup.withData": "● עם נתוני צבע מדודים",
  "optgroup.allMakes": "כל היצרנים (NHTSA vPIC)",
  "optgroup.allModels": "כל הדגמים (NHTSA)",
  "optgroup.genericColors": "צבעי רכב כלליים (בקירוב)",

  "availability.noData":
    "עדיין אין נתוני צבע יצרן עבור <strong>{make} {model}</strong> — ההתאמה מתבצעת מול <strong>צבעי רכב כלליים</strong>. הדיוק נמוך יותר לעומת OEM נתמך.",

  "results.heading": "התוצאות שלך",
  "results.picksSublabel": "בחירות OPI מובילות לצבע הזה",
  "results.distantBanner": "עדיין אין גוון OPI קרוב בקטלוג הזה — הרחבה בהמשך.",
  "results.finishDisclaimer":
    "צבע מטאלי משתנה לפי זווית — ערך LAB הוא ממוצע; התייחסו להמלצות ככיוון, לא כזהות מוחלטת.",
  "results.tierLegend": `<strong>
      <abbr title="ΔE (CIEDE2000) — מרחק צבע אחיד תפיסתית.">ΔE</abbr>
      רמות
    </strong>
    · מצוין &lt;1 (כמעט לא מורגש) · קרוב 1–2 · לבדיקה 2–4 (מורגש) · רחוק 4+`,

  "tier.perfect": "מצוין",
  "tier.close": "קרוב",
  "tier.explore": "שווה בדיקה",
  "tier.distant": "רחוק",
  "tierTip.perfect": "ΔE מתחת ל-1 — נראה זהה כמעט לכל הצופים.",
  "tierTip.close": "ΔE בין 1 ל-2 — התאמה טובה מאוד עם הבדל עדין.",
  "tierTip.explore": "ΔE בין 2 ל-4 — הבדל נראה לעין, אבל באותה משפחת צבע.",
  "tierTip.distant": "ΔE מעל 4 — גוון או בהירות שונים באופן ברור.",

  "conf.measured": "נמדד",
  "conf.spec": "ממפרט",
  "conf.derivedHex": "נגזר מ-HEX",
  "conf.derivedChip": "נגזר משבב",
  "conf.derivedOther": "נגזר (משוער)",
  "conf.estimated": "מוערך",
  "conf.generic": "פלטה כללית",
  "confTip.measured": "מדידת ספקטרופוטומטר על דוגמית פיזית — רמת אמון גבוהה ביותר.",
  "confTip.spec": "מבוסס על מסמך מפרט OEM או מקור מורשה.",
  "confTip.derivedHex": "הומר מערך HEX שפורסם או מערך תיקון תעשייתי.",
  "confTip.derivedChip":
    "ממוצע מתמונת שבב PaintRef — צימוד שורה↔שבב שגוי מעוות גוון.",
  "confTip.derivedOther": "הומר או הוסק ממקור משני — לא מדידת ספקטרו ישירה.",
  "confTip.estimated": "ערך משוער עד להוספת מדידה מאומתת.",
  "confTip.generic":
    "צבע מקורב מפלטה אוניברסלית שנגזרה מ-HEX. זו אינה מדידת יצרן בפועל.",
  "swatch.carTitle":
    "צבע מקורב שמוצג מערכי L*a*b* מדודים. המראה בפועל משתנה לפי מסך וסוג הגימור.",

  "glossary.summary": "מה המשמעות של ΔE, LAB ו-OPI?",
  "glossary.opi.term": "OPI",
  "glossary.opi.def":
    "מותג לקים עולמי — קלאסיקה בסלונים מאז 1981. Lacca משווה את צבע הרכב שלכם לגווני OPI.",
  "glossary.deltaE.term": "ΔE (Delta-E, CIEDE2000)",
  "glossary.deltaE.def": `מספר יחיד שמתאר עד כמה שני צבעים נראים שונים.
    <strong>&lt;1</strong> כמעט לא מורגש ·
    <strong>1–2</strong> קרוב ·
    <strong>2–4</strong> מורגש ·
    <strong>4+</strong> שונה בבירור.
    Lacca מדרגת לפי <strong>CIEDE2000</strong>, שמשקלל בהירות, כרומה וגוון באופן שקרוב יותר לראייה אנושית.`,
  "glossary.lab.term": "L*a*b* (CIELAB)",
  "glossary.lab.def": `מרחב צבעים שתוכנן להתאים לתפיסה האנושית.
    <strong>L*</strong> = בהירות (0 שחור → 100 לבן),
    <strong>a*</strong> = ירוק↔אדום,
    <strong>b*</strong> = כחול↔צהוב.`,
  "glossary.d65.term": "D65 / צופה 2°",
  "glossary.d65.def":
    "תנאי תאורה וזווית צפייה תקניים למדידות צבע — בקירוב אור יום בצהריים במבט חזיתי.",
  "glossary.finish.term": "גימור",
  "glossary.finish.def": `<strong>סולידי</strong> — צבע אחיד ושטוח.
    <strong>מטאלי</strong> — פתיתי אלומיניום שמשתנים עם האור.
    <strong>פנינה</strong> — פיגמנטים מסוג מיקה עם ברק עדין.
    <strong>רב-שכבתי</strong> — כמה שכבות לעומק ועושר.
    <strong>מט</strong> — ללא החזר אור.`,
  "glossary.catalog.term": "קטלוג / SKU",
  "glossary.catalog.def":
    "SKU הוא קוד מוצר ייחודי לגוון יחיד. הקטלוג מאגד SKU-ים רבים עם אותה גרסה ותנאי מדידה משותפים.",
  "footer.text": `רשימת היצרנים והדגמים נטענת בזמן אמת ממאגר הרכב החינמי של
    <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noopener">NHTSA vPIC</a>.
    כיסוי צבעים ממותג כולל: <strong>Tesla Model 3 / Model Y</strong> ו-
    <strong>BMW X-line (X1–X7, iX, XM)</strong> לצפון אמריקה, 2020–2026.
    כל יצרן/דגם אחר נופל לפלטה כללית שנגזרת מ-HEX, לכן ההתאמה אוניברסלית אך מקורבת מחוץ ל-OEM-ים הנתמכים — חפשו את תג <em>generic</em>.`
};

export const SUPPORTED_LOCALES: Locale[] = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ja",
  "zh",
  "ko",
  "he"
];

export const translations: Record<Locale, TranslationKeys> = {
  en,
  es,
  fr,
  de,
  it,
  pt,
  ja,
  zh,
  ko,
  he
};
