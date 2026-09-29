/**
 * High-aesthetic SVG side-profile ship illustrations for Port of Call.
 * Renders detailed, themed vector profiles for all 5 vessel blueprints
 * with custom company hull colors, deck equipment, and waterline shading.
 */

export function getShipIllustrationSVG(type: string, companyColor: string = '#00d2ff'): string {
  switch (type) {
    case 'tramp':
    case 'tramp_steamer':
      return `
      <svg viewBox="0 0 360 120" class="ship-svg-illustration" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tramp-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#092644"/>
            <stop offset="100%" stop-color="#051426"/>
          </linearGradient>
          <linearGradient id="tramp-hull" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#1e272e"/>
            <stop offset="60%" stop-color="#2f3640"/>
            <stop offset="100%" stop-color="#1e272e"/>
          </linearGradient>
        </defs>
        <!-- Waterline -->
        <rect x="0" y="90" width="360" height="30" fill="url(#tramp-sea)" opacity="0.6"/>
        <path d="M0 90 Q 90 88 180 90 T 360 90" stroke="#00d2ff" stroke-width="1.5" fill="none" opacity="0.4"/>
        
        <!-- Antifouling Keel (Red) -->
        <path d="M45 90 L70 102 L290 102 L315 90 Z" fill="#8b0000"/>

        <!-- Main Hull -->
        <path d="M40 70 Q 55 90 70 90 L 290 90 Q 305 90 320 70 L 315 65 L 45 65 Z" fill="url(#tramp-hull)"/>
        <!-- Company Stripe -->
        <path d="M48 68 L 312 68 L 310 72 L 50 72 Z" fill="${companyColor}"/>

        <!-- Forecastle (Bow) -->
        <path d="M40 70 L 60 55 L 95 55 L 95 65 L 45 65 Z" fill="#353b48"/>
        <!-- Forward Mast & Cargo Derrick -->
        <line x1="120" y1="65" x2="120" y2="25" stroke="#dcdde1" stroke-width="2"/>
        <line x1="120" y1="42" x2="90" y2="58" stroke="#718093" stroke-width="1.5"/>
        <line x1="120" y1="42" x2="150" y2="58" stroke="#718093" stroke-width="1.5"/>

        <!-- Cargo Hatches -->
        <rect x="100" y="60" width="40" height="5" fill="#1e272e"/>
        <rect x="220" y="60" width="40" height="5" fill="#1e272e"/>

        <!-- Midships Superstructure / Wheelhouse -->
        <rect x="165" y="45" width="45" height="20" fill="#f5f6fa" rx="1"/>
        <rect x="175" y="32" width="28" height="13" fill="#f5f6fa" rx="1"/>
        <!-- Bridge Windows -->
        <rect x="177" y="35" width="24" height="4" fill="#00d2ff"/>
        <!-- Smokestack Funnel -->
        <rect x="180" y="15" width="10" height="17" fill="#ffa502"/>
        <rect x="180" y="15" width="10" height="4" fill="#1e272e"/>
        <!-- Smoke Puffs -->
        <circle cx="185" cy="10" r="3" fill="#ffffff" opacity="0.3"/>
        <circle cx="190" cy="6" r="4.5" fill="#ffffff" opacity="0.15"/>

        <!-- Aft Mast -->
        <line x1="240" y1="65" x2="240" y2="30" stroke="#dcdde1" stroke-width="2"/>
        <line x1="240" y1="45" x2="210" y2="58" stroke="#718093" stroke-width="1.5"/>
        <line x1="240" y1="45" x2="270" y2="58" stroke="#718093" stroke-width="1.5"/>

        <!-- Poop Deck (Stern) -->
        <path d="M275 65 L 275 56 L 315 56 L 320 70 Z" fill="#353b48"/>
      </svg>`;

    case 'freighter':
    case 'general_freighter':
      return `
      <svg viewBox="0 0 360 120" class="ship-svg-illustration" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="freighter-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#092644"/>
            <stop offset="100%" stop-color="#051426"/>
          </linearGradient>
        </defs>
        <!-- Waterline -->
        <rect x="0" y="90" width="360" height="30" fill="url(#freighter-sea)" opacity="0.6"/>
        <path d="M0 90 Q 90 88 180 90 T 360 90" stroke="#00d2ff" stroke-width="1.5" fill="none" opacity="0.4"/>

        <!-- Antifouling Keel -->
        <path d="M30 90 L55 104 L310 104 L335 90 Z" fill="#9c1d1d"/>

        <!-- Main Hull -->
        <path d="M25 65 Q 40 90 55 90 L 310 90 Q 325 90 340 65 L 332 60 L 32 60 Z" fill="#2c3e50"/>
        <!-- Company Stripe -->
        <path d="M30 63 L 334 63 L 332 67 L 32 67 Z" fill="${companyColor}"/>

        <!-- Deck Cranes / Derricks -->
        <rect x="75" y="55" width="32" height="5" fill="#1e272e"/>
        <rect x="125" y="55" width="32" height="5" fill="#1e272e"/>
        <rect x="175" y="55" width="32" height="5" fill="#1e272e"/>

        <!-- Crane Towers -->
        <path d="M60 60 L 60 30 L 65 30 L 65 60 Z" fill="#dcdde1"/>
        <line x1="62" y1="35" x2="95" y2="48" stroke="#ffa502" stroke-width="2"/>
        <path d="M160 60 L 160 30 L 165 30 L 165 60 Z" fill="#dcdde1"/>
        <line x1="162" y1="35" x2="195" y2="48" stroke="#ffa502" stroke-width="2"/>

        <!-- Aft Bridge Superstructure -->
        <rect x="235" y="40" width="55" height="20" fill="#f5f6fa" rx="2"/>
        <rect x="245" y="25" width="40" height="15" fill="#f5f6fa" rx="2"/>
        <rect x="250" y="16" width="28" height="9" fill="#dfe4ea" rx="1"/>
        <!-- Bridge Windows -->
        <rect x="252" y="18" width="24" height="3.5" fill="#00d2ff"/>
        <!-- Radar Mast -->
        <line x1="264" y1="16" x2="264" y2="6" stroke="#718093" stroke-width="1.5"/>
        <ellipse cx="264" cy="8" rx="5" ry="1.5" fill="#00d2ff"/>

        <!-- Funnel -->
        <path d="M282 12 L 294 12 L 292 38 L 282 38 Z" fill="${companyColor}"/>
        <rect x="282" y="12" width="12" height="5" fill="#1e272e"/>
      </svg>`;

    case 'bulk':
    case 'bulk_carrier':
      return `
      <svg viewBox="0 0 360 120" class="ship-svg-illustration" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bulk-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#092644"/>
            <stop offset="100%" stop-color="#051426"/>
          </linearGradient>
        </defs>
        <!-- Waterline -->
        <rect x="0" y="90" width="360" height="30" fill="url(#bulk-sea)" opacity="0.6"/>
        <path d="M0 90 Q 90 88 180 90 T 360 90" stroke="#00d2ff" stroke-width="1.5" fill="none" opacity="0.4"/>

        <!-- Low Freeboard Antifouling Keel -->
        <path d="M15 90 L40 106 L320 106 L345 90 Z" fill="#7a1414"/>

        <!-- Long Massive Bulk Hull -->
        <path d="M12 68 Q 28 90 40 90 L 320 90 Q 335 90 348 68 L 344 63 L 18 63 Z" fill="#1e272e"/>
        <!-- Company Stripe -->
        <path d="M18 65 L 344 65 L 342 68 L 20 68 Z" fill="${companyColor}"/>

        <!-- Raised Bow Forecastle -->
        <path d="M12 68 L 25 56 L 48 56 L 48 63 L 18 63 Z" fill="#353b48"/>

        <!-- 6 Large Bulk Cargo Hatches -->
        <rect x="55" y="59" width="28" height="4" fill="#57606f" rx="1"/>
        <rect x="90" y="59" width="28" height="4" fill="#57606f" rx="1"/>
        <rect x="125" y="59" width="28" height="4" fill="#57606f" rx="1"/>
        <rect x="160" y="59" width="28" height="4" fill="#57606f" rx="1"/>
        <rect x="195" y="59" width="28" height="4" fill="#57606f" rx="1"/>
        <rect x="230" y="59" width="28" height="4" fill="#57606f" rx="1"/>

        <!-- Tall Aft Accommodations Tower -->
        <rect x="275" y="38" width="48" height="25" fill="#f1f2f6" rx="2"/>
        <rect x="282" y="24" width="36" height="14" fill="#f1f2f6" rx="1"/>
        <rect x="288" y="14" width="26" height="10" fill="#dfe4ea" rx="1"/>
        <rect x="290" y="16" width="22" height="4" fill="#00d2ff"/>

        <!-- Funnel -->
        <path d="M316 10 L 326 10 L 324 35 L 316 35 Z" fill="#ffa502"/>
        <rect x="316" y="10" width="10" height="4" fill="#1e272e"/>
      </svg>`;

    case 'container':
    case 'container_ship':
      return `
      <svg viewBox="0 0 360 120" class="ship-svg-illustration" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cont-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#092644"/>
            <stop offset="100%" stop-color="#051426"/>
          </linearGradient>
        </defs>
        <!-- Waterline -->
        <rect x="0" y="90" width="360" height="30" fill="url(#cont-sea)" opacity="0.6"/>
        <path d="M0 90 Q 90 88 180 90 T 360 90" stroke="#00d2ff" stroke-width="1.5" fill="none" opacity="0.4"/>

        <!-- Bulbous Bow & Keel -->
        <path d="M12 90 L35 105 L325 105 L348 90 Z" fill="#8b0000"/>

        <!-- Sleek High-Speed Container Hull -->
        <path d="M10 60 Q 25 90 35 90 L 325 90 Q 338 90 350 60 L 345 56 L 20 56 Z" fill="#192a56"/>
        <!-- Company Stripe -->
        <path d="M18 58 L 346 58 L 344 62 L 20 62 Z" fill="${companyColor}"/>

        <!-- Container Stacks Tier 1 & 2 -->
        <!-- Bay 1 (Red & Blue) -->
        <rect x="42" y="44" width="30" height="12" fill="#eb4d4b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="42" y="32" width="30" height="12" fill="#30336b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="42" y="20" width="30" height="12" fill="#f0932b" stroke="#130f40" stroke-width="0.5"/>

        <!-- Bay 2 (Green & Orange) -->
        <rect x="75" y="44" width="30" height="12" fill="#6ab04c" stroke="#130f40" stroke-width="0.5"/>
        <rect x="75" y="32" width="30" height="12" fill="#eb4d4b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="75" y="20" width="30" height="12" fill="#22a6b3" stroke="#130f40" stroke-width="0.5"/>

        <!-- Bay 3 (Cyan & Gold) -->
        <rect x="108" y="44" width="30" height="12" fill="#22a6b3" stroke="#130f40" stroke-width="0.5"/>
        <rect x="108" y="32" width="30" height="12" fill="#f0932b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="108" y="20" width="30" height="12" fill="#30336b" stroke="#130f40" stroke-width="0.5"/>

        <!-- Bay 4 -->
        <rect x="141" y="44" width="30" height="12" fill="#30336b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="141" y="32" width="30" height="12" fill="#6ab04c" stroke="#130f40" stroke-width="0.5"/>
        <rect x="141" y="20" width="30" height="12" fill="#eb4d4b" stroke="#130f40" stroke-width="0.5"/>

        <!-- Bay 5 -->
        <rect x="174" y="44" width="30" height="12" fill="#eb4d4b" stroke="#130f40" stroke-width="0.5"/>
        <rect x="174" y="32" width="30" height="12" fill="#f0932b" stroke="#130f40" stroke-width="0.5"/>

        <!-- Bay 6 -->
        <rect x="207" y="44" width="30" height="12" fill="#22a6b3" stroke="#130f40" stroke-width="0.5"/>
        <rect x="207" y="32" width="30" height="12" fill="#30336b" stroke="#130f40" stroke-width="0.5"/>

        <!-- Slim Tall Bridge Superstructure -->
        <rect x="250" y="30" width="40" height="26" fill="#f5f6fa" rx="2"/>
        <rect x="256" y="16" width="32" height="14" fill="#f5f6fa" rx="1"/>
        <rect x="260" y="8" width="24" height="8" fill="#dcdde1" rx="1"/>
        <rect x="262" y="10" width="20" height="3" fill="#00d2ff"/>

        <!-- Funnel Tower -->
        <path d="M294 6 L 306 6 L 304 38 L 294 38 Z" fill="${companyColor}"/>
        <rect x="294" y="6" width="12" height="4" fill="#1e272e"/>

        <!-- Aft Containers -->
        <rect x="308" y="44" width="28" height="12" fill="#6ab04c" stroke="#130f40" stroke-width="0.5"/>
        <rect x="308" y="32" width="28" height="12" fill="#eb4d4b" stroke="#130f40" stroke-width="0.5"/>
      </svg>`;

    case 'tanker':
    case 'super_tanker':
      return `
      <svg viewBox="0 0 360 120" class="ship-svg-illustration" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tanker-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#092644"/>
            <stop offset="100%" stop-color="#051426"/>
          </linearGradient>
        </defs>
        <!-- Waterline -->
        <rect x="0" y="90" width="360" height="30" fill="url(#tanker-sea)" opacity="0.6"/>
        <path d="M0 90 Q 90 88 180 90 T 360 90" stroke="#00d2ff" stroke-width="1.5" fill="none" opacity="0.4"/>

        <!-- Deep Draft Keel -->
        <path d="M8 90 L30 108 L330 108 L352 90 Z" fill="#6b0e0e"/>

        <!-- Colossal Tanker Hull -->
        <path d="M5 70 Q 20 90 30 90 L 330 90 Q 342 90 355 70 L 350 65 L 12 65 Z" fill="#2d3436"/>
        <!-- Company Stripe -->
        <path d="M10 67 L 352 67 L 350 71 L 12 71 Z" fill="${companyColor}"/>

        <!-- Catwalk Pipeline Trunk & Manifolds -->
        <line x1="35" y1="62" x2="270" y2="62" stroke="#636e72" stroke-width="2"/>
        <circle cx="90" cy="62" r="3" fill="#b2bec3"/>
        <circle cx="150" cy="62" r="3" fill="#b2bec3"/>
        <circle cx="210" cy="62" r="3" fill="#b2bec3"/>
        <rect x="145" y="52" width="12" height="10" fill="#636e72" rx="1"/>

        <!-- Hose Handling Crane -->
        <path d="M148 52 L 148 35 L 165 42" stroke="#ffa502" stroke-width="2" fill="none"/>

        <!-- Massive Aft Castle -->
        <rect x="275" y="42" width="55" height="23" fill="#f5f6fa" rx="2"/>
        <rect x="282" y="26" width="44" height="16" fill="#f5f6fa" rx="2"/>
        <rect x="290" y="14" width="32" height="12" fill="#dfe4ea" rx="1"/>
        <rect x="292" y="16" width="28" height="4" fill="#00d2ff"/>

        <!-- Twin Funnels -->
        <path d="M315 8 L 324 8 L 322 28 L 315 28 Z" fill="${companyColor}"/>
        <rect x="315" y="8" width="9" height="3" fill="#1e272e"/>
        <path d="M326 10 L 333 10 L 331 28 L 326 28 Z" fill="${companyColor}"/>
        <rect x="326" y="10" width="7" height="3" fill="#1e272e"/>
      </svg>`;

    default:
      return '';
  }
}
