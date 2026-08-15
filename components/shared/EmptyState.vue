<template>
  <div class="empty-state">
    <!-- Per-page illustrations drawn inline so they inherit the theme's
         brand colours in light AND dark mode (a PNG can't). -->
    <div v-if="illustration" class="empty-illustration" aria-hidden="true">
      <img v-if="illustration === 'library' || illustration === 'books'" class="empty-illustration-img" src="/Images/Empty State 2.png" alt="" />
      <img v-else-if="illustration === 'series'" class="empty-illustration-img" src="/Images/Empty State 3.png" alt="" />
      <img v-else-if="illustration === 'favourites'" class="empty-illustration-img" src="/Images/Favourites empty-state.png" alt="" />
      <img v-else-if="illustration === 'playlists'" class="empty-illustration-img" src="/Images/Playlist empty-state.png" alt="" />

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

.empty-illustration svg,
.empty-illustration-img {
  width: 100%;
  height: auto;
  max-height: 160px;
  object-fit: contain;
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
