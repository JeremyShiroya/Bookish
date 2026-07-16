<template>
  <div class="empty-state">
    <!-- Per-page illustrations drawn inline so they inherit the theme's
         brand colours in light AND dark mode (a PNG can't). -->
    <div v-if="illustration" class="empty-illustration" aria-hidden="true">
      <!-- Home: an open book under a reading glow -->
      <svg v-if="illustration === 'library'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="92" rx="80" ry="46" />
        <path class="art-deep" d="M100 58 C82 46 58 44 42 49 c-2 .7 -3 2 -3 4 v54 c0 3 3 5 6 4 c14 -4 38 -2 55 9 c17 -11 41 -13 55 -9 c3 1 6 -1 6 -4 V53 c0 -2 -1 -3.3 -3 -4 c-16 -5 -40 -3 -58 9 Z" />
        <path class="art-page" d="M100 62 C85 51 63 49 48 53 v52 c15 -3 37 -1 52 9 Z" />
        <path class="art-page" d="M100 62 c15 -11 37 -13 52 -9 v52 c-15 -3 -37 -1 -52 9 Z" />
        <g class="art-lines">
          <path d="M57 66 c11 -2 24 -1 35 4" />
          <path d="M57 78 c11 -2 24 -1 35 4" />
          <path d="M57 90 c8 -1.5 17 -1 25 1.5" />
          <path d="M143 66 c-11 -2 -24 -1 -35 4" />
          <path d="M143 78 c-11 -2 -24 -1 -35 4" />
        </g>
        <path class="art-accent art-float" d="M63 24 l3.2 7.3 7.3 3.2 -7.3 3.2 -3.2 7.3 -3.2 -7.3 -7.3 -3.2 7.3 -3.2 Z" />
        <circle class="art-dot" cx="148" cy="30" r="4" />
        <path class="art-plus" d="M166 52 h10 M171 47 v10" />
      </svg>

      <!-- Books: a stack waiting to grow, bookmark tucked in -->
      <svg v-else-if="illustration === 'books'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="94" rx="78" ry="44" />
        <rect class="art-deep" x="50" y="98" width="104" height="20" rx="7" />
        <rect class="art-edge" x="142" y="102" width="7" height="12" rx="2.5" />
        <rect class="art-tint" x="58" y="76" width="96" height="20" rx="7" />
        <rect class="art-edge" x="146" y="80" width="7" height="12" rx="2.5" />
        <rect class="art-ink" x="44" y="54" width="104" height="20" rx="7" />
        <rect class="art-edge" x="136" y="58" width="7" height="12" rx="2.5" />
        <path class="art-accent" d="M116 55 h13 v27 l-6.5 -7 -6.5 7 Z" />
        <path class="art-accent art-float" d="M160 34 l2.8 6.4 6.4 2.8 -6.4 2.8 -2.8 6.4 -2.8 -6.4 -6.4 -2.8 6.4 -2.8 Z" />
        <circle class="art-dot" cx="46" cy="34" r="4" />
      </svg>

      <!-- Favourites: a heart lifting off a well-loved book -->
      <svg v-else-if="illustration === 'favourites'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="92" rx="76" ry="44" />
        <rect class="art-ink" x="66" y="62" width="68" height="58" rx="9" />
        <rect class="art-deep" x="66" y="62" width="13" height="58" rx="6" />
        <rect class="art-inner" x="88" y="72" width="37" height="38" rx="5" />
        <path class="art-accent art-float" d="M100 52 C92 44 88 37 92.5 31 c3.2 -4.2 8.5 -3 7.5 2.5 c-1 -5.5 4.3 -6.7 7.5 -2.5 C112 37 108 44 100 52 Z" />
        <path class="art-heart-sm" d="M132 36 c-3.4 -3.4 -5 -6.3 -3.1 -8.8 c1.3 -1.8 3.6 -1.3 3.1 1 c-.4 -2.3 1.8 -2.8 3.2 -1 c1.8 2.5 .2 5.4 -3.2 8.8 Z" />
        <path class="art-heart-xs" d="M70 32 c-2.5 -2.5 -3.7 -4.7 -2.3 -6.5 c1 -1.4 2.7 -1 2.3 .8 c-.3 -1.8 1.4 -2.2 2.4 -.8 c1.4 1.8 .1 4 -2.4 6.5 Z" />
      </svg>

      <!-- Series: a shelf of matching spines, one leaning -->
      <svg v-else-if="illustration === 'series'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="92" rx="78" ry="44" />
        <rect class="art-shelf" x="40" y="114" width="120" height="6" rx="3" />
        <rect class="art-ink" x="60" y="58" width="19" height="56" rx="4.5" />
        <rect class="art-band" x="60" y="66" width="19" height="6" />
        <rect class="art-tint" x="83" y="52" width="19" height="62" rx="4.5" />
        <rect class="art-band-accent" x="83" y="61" width="19" height="6" />
        <g transform="rotate(9 135 114)">
          <rect class="art-deep" x="108" y="56" width="19" height="58" rx="4.5" />
          <rect class="art-band" x="108" y="64" width="19" height="6" />
        </g>
        <path class="art-accent art-float" d="M152 34 l3 6.8 6.8 3 -6.8 3 -3 6.8 -3 -6.8 -6.8 -3 6.8 -3 Z" />
        <circle class="art-dot" cx="52" cy="38" r="4" />
      </svg>

      <!-- Playlists: a fan of book covers with a count badge — the same
           shape as the app's playlist cards, so it reads "collection of
           books", not "music player". -->
      <svg v-else-if="illustration === 'playlists'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="92" rx="78" ry="44" />
        <g transform="rotate(-12 74 118)">
          <rect class="art-tint" x="52" y="60" width="40" height="58" rx="6" />
        </g>
        <g transform="rotate(12 128 118)">
          <rect class="art-deep" x="108" y="60" width="40" height="58" rx="6" />
        </g>
        <rect class="art-ink" x="79" y="52" width="42" height="64" rx="6" />
        <rect class="art-inner" x="86" y="60" width="28" height="48" rx="4" />
        <circle class="art-accent" cx="141" cy="112" r="14" />
        <path class="art-badge-plus" d="M135 112 h12 M141 106 v12" />
        <path class="art-accent art-float" d="M56 32 l2.8 6.4 6.4 2.8 -6.4 2.8 -2.8 6.4 -2.8 -6.4 -6.4 -2.8 6.4 -2.8 Z" />
        <circle class="art-dot" cx="150" cy="36" r="4" />
      </svg>

      <!-- Filtered view with no matches: a magnifier over the shelf -->
      <svg v-else-if="illustration === 'filter'" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <ellipse class="art-halo" cx="100" cy="92" rx="76" ry="44" />
        <rect class="art-tint" x="52" y="66" width="56" height="48" rx="8" />
        <rect class="art-deep" x="52" y="66" width="11" height="48" rx="5.5" />
        <g class="art-glass">
          <circle cx="122" cy="76" r="21" />
          <path class="art-handle" d="M137 91 l14 15" />
          <path class="art-glint" d="M112 68 a13 13 0 0 1 9 -4" />
        </g>
        <path class="art-accent art-float" d="M158 40 l2.8 6.4 6.4 2.8 -6.4 2.8 -2.8 6.4 -2.8 -6.4 -6.4 -2.8 6.4 -2.8 Z" />
      </svg>
    </div>

    <img v-else-if="image" class="empty-image" :src="image" alt="" />
    <div v-else class="empty-icon-wrap">
      <i :class="icon"></i>
    </div>

    <h2 class="empty-title">{{ title }}</h2>
    <p class="empty-description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  icon: {
    type: String,
    default: "ri-inbox-line"
  },
  // Named inline illustration: library | books | favourites | series |
  // playlists | filter. Takes priority over image and icon.
  illustration: {
    type: String,
    default: ""
  },
  // When set (and no illustration), an image replaces the icon badge.
  image: {
    type: String,
    default: ""
  }
});
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-illustration {
  width: min(230px, 68%);
  margin-bottom: 1rem;
  animation: empty-rise 0.5s ease-out both;
}

.empty-illustration svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Illustration palette — every tone comes from the theme so the artwork
   flips correctly with dark mode. The amber accent matches the logo frame. */
.art-halo { fill: var(--color-brand-primary-faint); }
.art-ink { fill: var(--color-brand-primary); }
.art-deep { fill: var(--color-brand-primary-hover); }
.art-tint { fill: var(--color-brand-primary-soft); }
.art-page { fill: var(--color-brand-primary-soft); }
.art-edge { fill: var(--color-brand-primary-soft); opacity: 0.85; }
.art-inner { fill: none; stroke: var(--color-brand-primary-soft); stroke-width: 2.5; opacity: 0.8; }
.art-accent { fill: #f2a25c; }
.art-band { fill: var(--color-brand-primary-faint); }
.art-band-accent { fill: #f2a25c; opacity: 0.9; }
.art-shelf { fill: var(--color-text-muted); opacity: 0.3; }
.art-dot { fill: var(--color-brand-primary); opacity: 0.4; }
.art-heart-sm { fill: var(--color-brand-primary); opacity: 0.45; }
.art-heart-xs { fill: var(--color-brand-primary); opacity: 0.3; }
.art-lines path { fill: none; stroke: var(--color-brand-primary); stroke-width: 2; stroke-linecap: round; opacity: 0.35; }
.art-plus { fill: none; stroke: var(--color-brand-primary); stroke-width: 2.5; stroke-linecap: round; opacity: 0.5; }
.art-badge-plus { fill: none; stroke: var(--color-text-on-brand, #fff); stroke-width: 3; stroke-linecap: round; }
.art-glass circle { fill: var(--color-brand-primary-faint); stroke: var(--color-brand-primary); stroke-width: 4.5; }
.art-handle { fill: none; stroke: var(--color-brand-primary); stroke-width: 6.5; stroke-linecap: round; }
.art-glint { fill: none; stroke: var(--color-brand-primary); stroke-width: 2.5; stroke-linecap: round; opacity: 0.45; }

.art-float {
  animation: art-drift 3.6s ease-in-out infinite;
}

.empty-image {
  width: min(200px, 62%);
  height: auto;
  margin-bottom: 1.5rem;
  object-fit: contain;
}

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--color-brand-primary-faint);
  border: 1px solid var(--color-brand-primary-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
}

.empty-icon-wrap i {
  font-size: 2.25rem;
  color: var(--color-brand-primary);
}

.empty-title {
  font-size: 1.375rem;
  font-weight: 650;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem 0;
  animation: empty-rise 0.5s ease-out 0.08s both;
}

.empty-description {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  max-width: 340px;
  margin: 0 0 1.75rem 0;
  line-height: 1.65;
  animation: empty-rise 0.5s ease-out 0.16s both;
}

.empty-action {
  animation: empty-rise 0.5s ease-out 0.24s both;
}

/* One CTA design for every empty state, whatever element the page slots in
   (link or button) — pages keep their own classes for other buttons. */
.empty-action :slotted(a),
.empty-action :slotted(button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: var(--mobile-touch-target, 44px);
  padding: 0.7rem 1.5rem;
  border: 0;
  border-radius: var(--mobile-control-radius, 12px);
  background: var(--color-brand-primary);
  color: var(--color-text-on-brand);
  font-family: inherit;
  font-size: var(--mobile-subtext-size, 0.9375rem);
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 10px 22px var(--color-brand-primary-faint);
}

.empty-action :slotted(a:active),
.empty-action :slotted(button:active) {
  transform: translateY(1px);
}

@keyframes empty-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes art-drift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@media (prefers-reduced-motion: reduce) {
  .empty-illustration,
  .empty-title,
  .empty-description,
  .empty-action,
  .art-float {
    animation: none;
  }
}
</style>
