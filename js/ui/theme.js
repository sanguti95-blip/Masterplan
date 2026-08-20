/**
 * Theme Engine: OLED Pure Black (#000000), Dark Slate, and Crisp Light Mode
 */
const ThemeEngine = {
  themes: ['oled', 'dark', 'light'],
  currentTheme: 'oled',

  init() {
    const saved = localStorage.getItem('mrp_theme') || 'oled';
    this.setTheme(saved, false);

    const btnToggle = document.getElementById('btn-theme-toggle');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => this.cycleTheme());
    }
  },

  setTheme(themeName, notify = true) {
    if (!this.themes.includes(themeName)) themeName = 'oled';
    this.currentTheme = themeName;
    localStorage.setItem('mrp_theme', themeName);

    document.body.classList.remove('theme-oled', 'theme-dark', 'theme-light', 'dark-theme');
    document.body.classList.add(`theme-${themeName}`);

    if (themeName === 'oled' || themeName === 'dark') {
      document.body.classList.add('dark-theme');
    }

    const labelSpan = document.getElementById('theme-label-text');
    if (labelSpan) {
      const names = { oled: 'OLED Puro', dark: 'Oscuro', light: 'Claro' };
      labelSpan.innerText = names[themeName] || 'OLED';
    }

    // Notify charts to update theme colors
    if (window.ChartManager && typeof window.ChartManager.updateThemeColors === 'function') {
      window.ChartManager.updateThemeColors(themeName);
    }

    if (notify && window.Toast) {
      const titles = { oled: 'Modo OLED Negro Puro activado', dark: 'Modo Oscuro activado', light: 'Modo Claro activado' };
      window.Toast.show(titles[themeName], 'info');
    }
  },

  cycleTheme() {
    const currentIndex = this.themes.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.setTheme(this.themes[nextIndex], true);
  }
};

window.ThemeEngine = ThemeEngine;
