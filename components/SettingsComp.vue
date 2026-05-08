<template>
  <div class="settings-wrapper">
    <!-- Settings Sidebar -->
    <aside class="settings-sidebar">
      <div class="sidebar-header">
        <h1 class="main-title">Settings</h1>
      </div>
      <nav class="settings-nav">
        <a 
          v-for="section in sections" 
          :key="section.id"
          :href="'#' + section.id"
          class="nav-link"
          :class="{ active: activeSection === section.id }"
          @click.prevent="scrollToSection(section.id)"
        >
          <i :class="section.icon"></i>
          <span>{{ section.title }}</span>
        </a>
      </nav>
    </aside>

    <!-- Settings Content -->
    <div class="settings-content" ref="contentArea" @scroll="handleScroll">
      
      <!-- Profile Section -->
      <section id="profile" class="settings-card">
        <div class="card-header">
          <div class="header-icon profile-icon">
            <i class="ri-user-smile-line"></i>
          </div>
          <div class="header-text">
            <h2>Profile</h2>
            <p>Manage your account presence and personal info.</p>
          </div>
        </div>
        
        <div class="profile-preview">
          <div class="avatar-large">
            <div class="avatar-inner">J</div>
            <button class="change-avatar">
              <i class="ri-camera-line"></i>
            </button>
          </div>
          <div class="profile-info">
            <div class="field-group">
              <label>Full Name</label>
              <div class="field-row">
                <input type="text" value="Jeremy" readonly />
                <button class="field-edit"><i class="ri-pencil-line"></i></button>
              </div>
            </div>
            <div class="field-group">
              <label>Email Address</label>
              <div class="field-row">
                <input type="email" value="jeremy@example.com" readonly />
                <button class="field-edit"><i class="ri-lock-line"></i></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Appearance Section -->
      <section id="appearance" class="settings-card">
        <div class="card-header">
          <div class="header-icon theme-icon">
            <i class="ri-palette-line"></i>
          </div>
          <div class="header-text">
            <h2>Appearance</h2>
            <p>Make the library feel like your own.</p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <h3>App Theme</h3>
            <p>Switch between light, purple, and dark modes.</p>
          </div>
          <div class="theme-grid">
            <div v-for="theme in themes" :key="theme.name" class="theme-option" :class="{ selected: currentTheme === theme.name }" @click="currentTheme = theme.name">
              <div class="theme-stack" :style="{ background: theme.bg }">
                <div class="stack-sidebar" :style="{ background: theme.side }"></div>
                <div class="stack-item" :style="{ background: theme.accent }"></div>
              </div>
              <span>{{ theme.name }}</span>
            </div>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <h3>Reading Interface</h3>
            <p>Adjust the font and sizing for the reader.</p>
          </div>
          <div class="font-controls">
            <button class="font-btn">Aa</button>
            <div class="range-slider">
              <input type="range" min="12" max="24" value="16" />
            </div>
            <button class="font-btn large">Aa</button>
          </div>
        </div>
      </section>

      <!-- Library Section -->
      <section id="library" class="settings-card">
        <div class="card-header">
          <div class="header-icon library-icon">
            <i class="ri-book-read-line"></i>
          </div>
          <div class="header-text">
            <h2>Library</h2>
            <p>Control your data and sync preferences.</p>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <div class="label-with-icon">
              <i class="ri-refresh-line"></i>
              <h3>Auto-Sync</h3>
            </div>
            <p>Sync your progress across all devices instantly.</p>
          </div>
          <label class="premium-switch">
            <input type="checkbox" checked />
            <span class="p-slider"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <div class="label-with-icon">
              <i class="ri-download-cloud-line"></i>
              <h3>Offline Storage</h3>
            </div>
            <p>Always keep your recent books available offline.</p>
          </div>
          <label class="premium-switch">
            <input type="checkbox" />
            <span class="p-slider"></span>
          </label>
        </div>
      </section>

      <!-- About Section -->
      <section id="about" class="settings-card about-card">
        <div class="about-logo">
          <img src="/Images/Logo.png" alt="Logo" />
          <h1>Bookish</h1>
          <p>Version 1.2.0 • Build 42</p>
        </div>
        <div class="about-links">
          <a href="#">Support Center</a>
          <a href="#">Release Notes</a>
          <a href="#">Privacy Policy</a>
        </div>
        <p class="copyright">© 2026 Bookish. Made with ❤️ for readers.</p>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const activeSection = ref("profile");
const currentTheme = ref("purple");
const contentArea = ref(null);

const sections = [
  { id: "profile", title: "Profile", icon: "ri-user-line" },
  { id: "appearance", title: "Appearance", icon: "ri-palette-line" },
  { id: "library", title: "Library", icon: "ri-book-read-line" },
  { id: "about", title: "About", icon: "ri-information-line" }
];

const themes = [
  { name: "Light", bg: "#f9fafb", side: "#ffffff", accent: "#3b82f6" },
  { name: "purple", bg: "#F8F8FF", side: "#E6E6FA", accent: "#8A2BE2" },
  { name: "Dark", bg: "#1f2937", side: "#111827", accent: "#60a5fa" }
];

const scrollToSection = (id) => {
  activeSection.value = id;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
};

const handleScroll = () => {
  const scrollPos = contentArea.value.scrollTop;
  sections.forEach(s => {
    const el = document.getElementById(s.id);
    if (el && el.offsetTop - 100 <= scrollPos) {
      activeSection.value = s.id;
    }
  });
};
</script>

<style scoped>
.settings-wrapper {
  display: flex;
  height: calc(100vh - 120px); /* Height minus padding and player bar */
  overflow: hidden;
}

/* Sidebar Styling */
.settings-sidebar {
  width: 220px;
  padding-right: 2rem;
  border-right: 1px solid #e5e7eb;
}

.main-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #233447;
  margin-bottom: 2rem;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  text-decoration: none;
  color: #6b7280;
  font-weight: 400;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f3f4f6;
  color: #233447;
}

.nav-link.active {
  background: #E6E6FA;
  color: #233447;
  box-shadow: 0 4px 6px -1px rgba(172, 211, 255, 0.4);
}

.nav-link i {
  font-size: 1.25rem;
}

/* Content Area Styling */
.settings-content {
  flex: 1;
  padding: 0 2rem;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}

/* Card Styling */
.settings-card {
  background: white;
  border-radius: 1.25rem;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  border: 1px solid #f3f4f6;
  transition: transform 0.3s ease;
}

.settings-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
}

.card-header {
  display: flex;
  gap: 1.25rem;
  align-items: center;
  margin-bottom: 2rem;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.profile-icon { background: #fee2e2; color: #ef4444; }
.theme-icon { background: #dcfce7; color: #22c55e; }
.library-icon { background: #F8F8FF; color: #3b82f6; }

.header-text h2 {
  font-size: 1.25rem;
  font-weight: 400;
  color: #233447;
  margin: 0;
}

.header-text p {
  color: #9ca3af;
  font-size: 0.875rem;
  margin: 0;
}

/* Profile Section */
.profile-preview {
  display: flex;
  gap: 3rem;
  align-items: center;
}

.avatar-large {
  position: relative;
}

.avatar-inner {
  width: 90px;
  height: 90px;
  background: #E6E6FA;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 400;
  color: white;
  box-shadow: 0 10px 15px -3px rgba(172, 211, 255, 0.5);
}

.change-avatar {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: white;
  border: 4px solid #f9fafb;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.profile-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field-group label {
  font-size: 0.75rem;
  font-weight: 400;
  color: #9ca3af;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  display: block;
}

.field-row {
  display: flex;
  align-items: center;
  background: #f9fafb;
  border-radius: 0.75rem;
  padding: 0 1rem;
}

.field-row input {
  flex: 1;
  background: transparent;
  border: none;
  padding: 0.75rem 0;
  font-weight: 400;
  color: #233447;
  font-family: inherit;
}

.field-edit {
  background: transparent;
  border: none;
  color: #8A2BE2;
  cursor: pointer;
}

/* Setting Rows */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #f3f4f6;
}

.setting-label h3 {
  font-size: 1rem;
  font-weight: 400;
  color: #233447;
  margin: 0;
}

.setting-label p {
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0.25rem 0 0 0;
}

.label-with-icon {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #8A2BE2;
}

/* Theme Options */
.theme-grid {
  display: flex;
  gap: 1.5rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.theme-stack {
  width: 80px;
  height: 50px;
  border-radius: 0.5rem;
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.theme-option.selected .theme-stack {
  border-color: #8A2BE2;
  box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.2);
}

.stack-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 25%;
}

.stack-item {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.theme-option span {
  font-size: 0.75rem;
  font-weight: 400;
  color: #6b7280;
}

/* Custom Controls */
.font-controls {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: #f9fafb;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
}

.font-btn {
  background: transparent;
  border: none;
  font-weight: 400;
  color: #233447;
  cursor: pointer;
}

.font-btn.large { font-size: 1.25rem; }

.range-slider input {
  width: 150px;
}

/* Premium Switch */
.premium-switch {
  position: relative;
  width: 54px;
  height: 28px;
}

.premium-switch input { opacity: 0; width: 0; height: 0; }

.p-slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #e5e7eb;
  transition: .4s;
  border-radius: 34px;
}

.p-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

input:checked + .p-slider { background-color: #8A2BE2; }
input:checked + .p-slider:before { transform: translateX(26px); }

/* About Card */
.about-card {
  text-align: center;
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%);
}

.about-logo img {
  width: 60px;
  margin-bottom: 1rem;
}

.about-logo h1 {
  font-size: 1.5rem;
  color: #233447;
  margin: 0;
}

.about-logo p {
  color: #9ca3af;
  font-size: 0.875rem;
  margin: 0.5rem 0 2rem 0;
}

.about-links {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.about-links a {
  color: #8A2BE2;
  font-weight: 400;
  text-decoration: none;
  font-size: 0.875rem;
}

.copyright {
  font-size: 0.75rem;
  color: #9ca3af;
}

@media (max-width: 900px) {
  .settings-wrapper {
    flex-direction: column;
    height: auto;
  }
  .settings-sidebar {
    width: 100%;
    padding: 0 0 2rem 0;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 2rem;
  }
  .settings-nav {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 1rem;
  }
  .nav-link {
    white-space: nowrap;
  }
  .settings-content {
    padding: 0;
  }
  .profile-preview {
    flex-direction: column;
  }
}
</style>
