/**
 * AppOrchestrator.js
 * 
 * Gestor central de la aplicación Suite Térmica.
 * Orquesta la interacción entre todas las apps y controla el flujo de datos.
 */

const AppOrchestrator = (() => {
    const APPS = {
        app1: {
            name: 'App 1: Trayectorias',
            description: 'Definidor de Corrientes y Trayectorias Dinámicas',
            icon: '🌡️',
            file: 'App1.html',
            storageKey: 'suite_thermal_trayectorias',
            order: 1,
            description_full: 'Define corrientes calientes y frías. Simula perfiles de temperatura (lineal, sinusoidal, exponencial, polinómico).',
            inputs: [],
            outputs: ['suite_thermal_trayectorias']
        },
        app2: {
            name: 'App 2: Propiedades',
            description: 'Expansor de Propiedades y Exergía Mecánica',
            icon: '⚙️',
            file: 'App2.html',
            storageKey: 'suite_thermal_data_enriched',
            order: 2,
            description_full: 'Enriquece trayectorias con propiedades reales de fluidos (H2, agua). Calcula Cp, densidad, viscosidad, exergía.',
            inputs: ['suite_thermal_trayectorias'],
            outputs: ['suite_thermal_data_enriched']
        },
        app3: {
            name: 'App 3: Ambiente',
            description: 'Auditor de Pérdidas Ambientales',
            icon: '🌍',
            file: 'App3.html',
            storageKey: 'suite_thermal_data_with_ambient',
            order: 3,
            description_full: 'Analiza interacción con ambiente. Calcula Número de Biot, área superficial, pérdidas transitorias.',
            inputs: ['suite_thermal_data_enriched'],
            outputs: ['suite_thermal_data_with_ambient']
        },
        app4: {
            name: 'App 4: Seguridad',
            description: 'Configurador de Seguridad y Límites',
            icon: '🔒',
            file: 'App4.html',
            storageKey: 'suite_thermal_final_setup',
            order: 4,
            description_full: 'Define límites de seguridad. Calcula Time-to-Limit y discretización temporal segura.',
            inputs: ['suite_thermal_data_with_ambient'],
            outputs: ['suite_thermal_final_setup']
        }
    };

    const state = {
        currentApp: null,
        dataStatus: {},
        completionPercentage: 0
    };

    /**
     * Inicializa la aplicación
     */
    function initialize() {
        console.log('🚀 Inicializando Suite Térmica...');
        
        UIManager.renderWorkflow(APPS);
        UIManager.renderAppSelector(APPS);
        updateDataStatus();
        setInterval(updateDataStatus, 1000); // Actualizar cada segundo

        // Event listeners
        document.querySelectorAll('[data-app]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const appKey = e.currentTarget.dataset.app;
                openApp(appKey);
            });
        });
    }

    /**
     * Abre una aplicación
     */
    function openApp(appKey) {
        const app = APPS[appKey];
        if (!app) return;

        // Validar requisitos previos
        const missingInputs = app.inputs.filter(key => !DataManager.has(key));
        
        if (missingInputs.length > 0) {
            UIManager.showModal(
                '⚠️ Requisitos No Cumplidos',
                `
                <p>Esta aplicación requiere datos de la aplicación anterior:</p>
                <ul style="list-style: disc; margin-left: 1.5rem; margin-top: 1rem;">
                    ${missingInputs.map(key => `<li><code>${key}</code></li>`).join('')}
                </ul>
                <p style="margin-top: 1rem; color: #6b7280; font-size: 0.875rem;">
                    💡 Sugerencia: Completa primero la <strong>${APPS[Object.keys(APPS).find(k => APPS[k].storageKey === missingInputs[0])].name}</strong>
                </p>
                <button class="btn btn-primary btn-sm" onclick="closeModal(); loadMockData();" style="margin-top: 1rem;">
                    📊 Generar Datos de Prueba
                </button>
                `
            );
            return;
        }

        state.currentApp = appKey;
        updateUIForApp(app);

        // Abrir en nueva ventana o iframe
        const width = window.innerWidth * 0.8;
        const height = window.innerHeight * 0.8;
        window.open(app.file, `_${appKey}`, `width=${width},height=${height},resizable=yes,scrollbars=yes`);
    }

    /**
     * Actualiza la UI para la app seleccionada
     */
    function updateUIForApp(app) {
        // Actualizar canvas title
        document.getElementById('canvas-title').textContent = app.name;
        document.getElementById('canvas-badge').textContent = app.icon + ' Activa';
        document.getElementById('canvas-badge').className = 'badge badge-info';

        // Actualizar info panel
        const infoHtml = `
            <div>
                <p><strong>${app.name}</strong></p>
                <p style="margin-top: 0.5rem; color: #6b7280; font-size: 0.875rem;">${app.description_full}</p>
                
                <div style="margin-top: 1rem; padding: 0.75rem; background: #f0fdf4; border-radius: 0.375rem; border-left: 3px solid #059669;">
                    <p style="font-size: 0.75rem; font-weight: 600; color: #059669;">ENTRADAS</p>
                    <p style="font-size: 0.75rem; color: #065f46; margin-top: 0.25rem;">
                        ${app.inputs.length > 0 ? app.inputs.join(', ') : 'Ninguna'}
                    </p>
                </div>

                <div style="margin-top: 0.75rem; padding: 0.75rem; background: #eff6ff; border-radius: 0.375rem; border-left: 3px solid #2563eb;">
                    <p style="font-size: 0.75rem; font-weight: 600; color: #2563eb;">SALIDAS</p>
                    <p style="font-size: 0.75rem; color: #1e40af; margin-top: 0.25rem;">
                        ${app.outputs.join(', ')}
                    </p>
                </div>

                <div style="margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="AppOrchestrator.openApp('${Object.keys(APPS).find(k => APPS[k] === app)}')">
                        🚀 Abrir ${app.name}
                    </button>
                </div>
            </div>
        `;
        document.getElementById('info-panel').innerHTML = infoHtml;

        // Actualizar próximo paso
        const nextAppKey = Object.keys(APPS).find(k => APPS[k].order === app.order + 1);
        if (nextAppKey) {
            const nextApp = APPS[nextAppKey];
            document.getElementById('next-step').innerHTML = `
                <p><strong>${nextApp.order}. ${nextApp.name}</strong></p>
                <p style="opacity: 0.7; margin-top: 0.5rem;">${nextApp.description}</p>
            `;
        }

        // Marcar app activa en selector
        document.querySelectorAll('[data-app]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-app="${Object.keys(APPS).find(k => APPS[k] === app)}"]`).classList.add('active');
    }

    /**
     * Actualiza el estado de los datos
     */
    function updateDataStatus() {
        const completedApps = Object.keys(APPS).filter(key => 
            DataManager.has(APPS[key].storageKey)
        ).length;

        state.completionPercentage = (completedApps / Object.keys(APPS).length) * 100;

        // Actualizar storage info
        document.getElementById('storage-apps').textContent = `${completedApps}/4`;
        
        const totalSize = Object.keys(APPS).reduce((sum, key) => {
            const data = DataManager.get(APPS[key].storageKey);
            return sum + (data ? JSON.stringify(data).length : 0);
        }, 0);
        document.getElementById('storage-size').textContent = `${(totalSize / 1024).toFixed(2)} KB`;

        // Actualizar status global
        const statusEl = document.getElementById('global-status');
        if (completedApps === 0) {
            statusEl.innerHTML = '<span style="color: #9ca3af;">●</span> <span id="status-text">Comenzar</span>';
        } else if (completedApps < 4) {
            statusEl.innerHTML = `<span style="color: #f59e0b;">●</span> <span id="status-text">En Progreso (${completedApps}/4)</span>`;
        } else {
            statusEl.innerHTML = '<span style="color: #10b981;">●</span> <span id="status-text">Completado ✓</span>';
        }

        // Actualizar status panel
        renderStatusPanel();

        // Actualizar workflow
        renderWorkflowProgress();
    }

    /**
     * Renderiza el panel de estado
     */
    function renderStatusPanel() {
        const html = Object.keys(APPS).map(key => {
            const app = APPS[key];
            const hasData = DataManager.has(app.storageKey);
            const status = hasData ? 'completed' : 'pending';
            const icon = hasData ? '✓' : '○';
            
            return `
                <div class="status-item ${status}">
                    <span class="status-icon">${icon}</span>
                    <span style="flex: 1; font-weight: 500; margin-left: 0.5rem;">${app.name}</span>
                    <span style="font-size: 0.75rem; opacity: 0.7; cursor: pointer;" onclick="AppOrchestrator.inspectData('${app.storageKey}')">
                        🔍 Ver
                    </span>
                </div>
            `;
        }).join('');
        
        document.getElementById('status-panel').innerHTML = html;
    }

    /**
     * Renderiza el progreso del workflow
     */
    function renderWorkflowProgress() {
        Object.keys(APPS).forEach(key => {
            const app = APPS[key];
            const stepEl = document.querySelector(`[data-step="${app.order}"]`);
            if (!stepEl) return;

            const hasData = DataManager.has(app.storageKey);
            stepEl.classList.remove('completed', 'active');
            
            if (hasData) {
                stepEl.classList.add('completed');
                stepEl.querySelector('.step-number').textContent = '✓';
            }
        });
    }

    /**
     * Inspecciona los datos de una aplicación
     */
    function inspectData(storageKey) {
        const data = DataManager.get(storageKey);
        if (!data) {
            UIManager.showModal('📊 Datos', 'Sin datos disponibles');
            return;
        }

        const json = JSON.stringify(data, null, 2);
        const preview = json.length > 500 ? json.substring(0, 500) + '...' : json;
        
        UIManager.showModal(
            `📊 Datos: ${storageKey}`,
            `
                <div class="data-viewer" style="white-space: pre-wrap; word-break: break-all;">
                    ${preview}
                </div>
                <p style="margin-top: 1rem; font-size: 0.75rem; color: #6b7280;">
                    Tamaño: ${(JSON.stringify(data).length / 1024).toFixed(2)} KB
                </p>
            `
        );
    }

    /**
     * Carga datos de prueba (mock)
     */
    function loadMockData() {
        console.log('📊 Cargando datos de prueba...');

        // Mock App 1: Trayectorias
        const mockApp1 = {
            K: 60,
            time: Array.from({length: 61}, (_, i) => i),
            streams: [
                {
                    id: 1,
                    name: "Corriente Caliente 1",
                    T: Array.from({length: 61}, (_, i) => 150 - (i * 70 / 60)),
                    Q_obs_init: Array.from({length: 61}, () => Math.random() * 2000 - 1000),
                    mCp_base: 5000
                },
                {
                    id: 2,
                    name: "Corriente Fría 2",
                    T: Array.from({length: 61}, (_, i) => 20 + (i * 40 / 60)),
                    Q_obs_init: Array.from({length: 61}, () => Math.random() * 1500 - 750),
                    mCp_base: 8000
                }
            ]
        };
        DataManager.set('suite_thermal_trayectorias', mockApp1);

        // Mock App 2: Propiedades
        const mockApp2 = {
            ...mockApp1,
            streams: mockApp1.streams.map(s => ({
                ...s,
                fluid: s.id === 1 ? 'H2' : 'Water',
                Cp_dinamico: Array.from({length: 61}, () => 3500 + Math.random() * 200),
                rho_dinamica: Array.from({length: 61}, () => 1.2 + Math.random() * 0.1),
                P_perfil_bar: Array.from({length: 61}, () => 100 - Math.random() * 10),
                Ex_P_perfil: Array.from({length: 61}, () => Math.random() * 50)
            }))
        };
        DataManager.set('suite_thermal_data_enriched', mockApp2);

        // Mock App 3: Ambiente
        const mockApp3 = {
            ...mockApp2,
            ambientAudit: {
                t_ambient: 25,
                streamsDetails: mockApp2.streams.map(s => ({
                    id: s.id,
                    name: s.name,
                    configuration: { k_solid: 1.0, h_conv: 200, geometry: 'sphere', h_amb: 5.0 },
                    calculations: { biotNumber: 0.05, characteristicLength: 0.1, actualSurfaceArea: 10, isLumpedModelValid: true },
                    q_amb_profile_W: Array.from({length: 61}, () => Math.random() * 100 - 50)
                }))
            }
        };
        DataManager.set('suite_thermal_data_with_ambient', mockApp3);

        // Mock App 4: Seguridad
        const mockApp4 = {
            ...mockApp3,
            K: 60,
            streams: mockApp3.streams.map(s => ({
                ...s,
                temps: s.T,
                derivatives: Array.from({length: 61}, () => Math.random() * 2 - 1),
                type: s.id === 1 ? 'hot' : 'cold'
            })),
            config_agregacion: {
                min_config_hold: 10,
                T_max_limit: 85,
                T_min_limit: -40
            },
            timestamp: new Date().toISOString()
        };
        DataManager.set('suite_thermal_final_setup', mockApp4);

        updateDataStatus();
        UIManager.showModal('✅ Éxito', 'Datos de prueba cargados. Todas las aplicaciones están listas para usar.');
    }

    /**
     * API Pública
     */
    return {
        initialize,
        openApp,
        loadMockData,
        inspectData,
        getApp: (key) => APPS[key],
        getApps: () => APPS,
        getState: () => state,
        updateDataStatus
    };
})();
