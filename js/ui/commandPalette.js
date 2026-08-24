/**
 * Command Palette Controller (Ctrl + K / Cmd + K)
 */
const CommandPalette = {
  isOpen: false,
  paletteElement: null,
  inputElement: null,
  resultsList: null,
  selectedIndex: 0,
  currentCommands: [],

  init() {
    this.paletteElement = document.getElementById('command-palette');
    this.inputElement = document.getElementById('palette-input');
    this.resultsList = document.getElementById('palette-results');

    if (!this.paletteElement || !this.inputElement || !this.resultsList) return;

    // Global Key Listener: Ctrl+K / Cmd+K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Close on overlay click
    this.paletteElement.addEventListener('click', (e) => {
      if (e.target === this.paletteElement) {
        this.close();
      }
    });

    // Input filter
    this.inputElement.addEventListener('input', (e) => {
      this.filter(e.target.value);
    });

    // Key navigation
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigate(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigate(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      }
    });

    // Header shortcut button
    const triggerBtn = document.getElementById('btn-open-palette');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.open());
    }
  },

  open() {
    this.isOpen = true;
    this.paletteElement.classList.add('active');
    this.inputElement.value = '';
    this.selectedIndex = 0;
    this.filter('');
    setTimeout(() => this.inputElement.focus(), 50);
  },

  close() {
    this.isOpen = false;
    this.paletteElement.classList.remove('active');
  },

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  },

  getAvailableCommands() {
    const baseCommands = [
      {
        id: 'cmd-day-lunes',
        title: 'Planificar para Lunes (Entrega Jueves / 72h)',
        category: 'Matriz MRP',
        icon: 'fa-calendar-day',
        action: () => window.App && window.App.setExecutionDay('Lunes')
      },
      {
        id: 'cmd-day-martes',
        title: 'Planificar para Martes (Entrega Viernes / 72h)',
        category: 'Matriz MRP',
        icon: 'fa-calendar-day',
        action: () => window.App && window.App.setExecutionDay('Martes')
      },
      {
        id: 'cmd-day-miercoles',
        title: 'Planificar para Miércoles (Entrega Sábado / 72h / 3 días cobertura)',
        category: 'Matriz MRP',
        icon: 'fa-calendar-day',
        action: () => window.App && window.App.setExecutionDay('Miercoles')
      },
      {
        id: 'cmd-day-jueves',
        title: 'Planificar para Jueves (Entrega Martes / 72h / 2 días cobertura)',
        category: 'Matriz MRP',
        icon: 'fa-calendar-day',
        action: () => window.App && window.App.setExecutionDay('Jueves')
      },
      {
        id: 'cmd-approve-order',
        title: 'Aprobar Pedido y Exportar Excel (.xlsx)',
        category: 'Acciones de Pedido',
        icon: 'fa-file-excel',
        action: () => window.App && window.App.approveAndExportOrder()
      },
      {
        id: 'cmd-export-excel',
        title: 'Descargar Archivo Excel (.xlsx) Actual',
        category: 'Acciones de Pedido',
        icon: 'fa-download',
        action: () => window.App && window.App.exportToExcel()
      },
      {
        id: 'cmd-sync-codisa',
        title: 'Sincronizar con Google Sheets / ERP CODISA',
        category: 'Integraciones',
        icon: 'fa-arrows-rotate',
        action: () => window.App && window.App.triggerLiveSync()
      },
      {
        id: 'cmd-tab-planner',
        title: 'Ir a Vista: Plan de Pedidos MRP',
        category: 'Navegación',
        icon: 'fa-table-list',
        action: () => window.App && window.App.switchTab('planner')
      },
      {
        id: 'cmd-tab-catalog',
        title: 'Ir a Vista: Maestro de Artículos (338 SKUs)',
        category: 'Navegación',
        icon: 'fa-list-check',
        action: () => window.App && window.App.switchTab('catalog')
      },
      {
        id: 'cmd-tab-transit',
        title: 'Ir a Vista: Órdenes en Tránsito Activas',
        category: 'Navegación',
        icon: 'fa-truck-fast',
        action: () => window.App && window.App.switchTab('transit')
      },
      {
        id: 'cmd-tab-sync',
        title: 'Ir a Vista: Sincronización Google Sheets',
        category: 'Navegación',
        icon: 'fa-cloud-arrow-down',
        action: () => window.App && window.App.switchTab('sync')
      },
      {
        id: 'cmd-tab-config',
        title: 'Ir a Vista: Configuración del Sistema',
        category: 'Navegación',
        icon: 'fa-sliders',
        action: () => window.App && window.App.switchTab('config')
      },
      {
        id: 'cmd-theme-cycle',
        title: 'Cambiar Tema (OLED Puro / Oscuro / Claro)',
        category: 'Apariencia',
        icon: 'fa-palette',
        action: () => window.ThemeEngine && window.ThemeEngine.cycleTheme()
      }
    ];

    // Add quick search for top catalog SKUs if query matches
    if (window.App && Array.isArray(window.App.items)) {
      const topItems = window.App.items.slice(0, 100).map(item => ({
        id: `sku-${item.codeSku}`,
        title: `${item.codeSku} - ${item.description}`,
        category: 'SKU Catálogo',
        icon: 'fa-box',
        action: () => {
          window.App.setSearchQuery(item.codeSku);
          window.App.switchTab('planner');
        }
      }));
      return [...baseCommands, ...topItems];
    }

    return baseCommands;
  },

  filter(query) {
    const q = (query || '').toLowerCase().trim();
    const all = this.getAvailableCommands();

    if (!q) {
      this.currentCommands = all.slice(0, 12);
    } else {
      this.currentCommands = all.filter(cmd => (
        cmd.title.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
      )).slice(0, 15);
    }

    this.selectedIndex = 0;
    this.render();
  },

  navigate(dir) {
    if (this.currentCommands.length === 0) return;
    this.selectedIndex = (this.selectedIndex + dir + this.currentCommands.length) % this.currentCommands.length;
    this.render();

    const activeItem = this.resultsList.querySelector('.palette-item.selected');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  },

  executeSelected() {
    if (this.currentCommands.length > 0 && this.currentCommands[this.selectedIndex]) {
      const selected = this.currentCommands[this.selectedIndex];
      this.close();
      if (typeof selected.action === 'function') {
        selected.action();
      }
    }
  },

  render() {
    if (this.currentCommands.length === 0) {
      this.resultsList.innerHTML = `
        <div class="palette-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>No se encontraron comandos o SKUs que coincidan con la búsqueda.</p>
        </div>
      `;
      return;
    }

    this.resultsList.innerHTML = this.currentCommands.map((cmd, idx) => `
      <div class="palette-item ${idx === this.selectedIndex ? 'selected' : ''}" data-index="${idx}">
        <div class="palette-item-left">
          <i class="fa-solid ${cmd.icon}"></i>
          <span class="palette-item-title">${cmd.title}</span>
        </div>
        <span class="palette-item-category">${cmd.category}</span>
      </div>
    `).join('');

    // Click selection
    this.resultsList.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        this.selectedIndex = Number(item.dataset.index);
        this.executeSelected();
      });
    });
  }
};

window.CommandPalette = CommandPalette;
