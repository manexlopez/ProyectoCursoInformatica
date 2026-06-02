/**
 * UIManager.js
 * 
 * Gestor centralizado de la interfaz de usuario.
 * Renderiza componentes, maneja eventos y actualiza la UI dinámicamente.
 */

const UIManager = (() => {
    /**
     * Renderiza el selector de aplicaciones
     */
    function renderAppSelector(apps) {
        const html = Object.entries(apps).map(([key, app]) => `
            <button data-app="${key}" class="app-btn slide-in">
                <div style="font-size: 1.25rem; margin-bottom: 0.5rem;">${app.icon}</div>
                <div style="font-weight: 600; color: var(--primary);">${app.name}</div>
                <span class="app-btn-label">${app.description}</span>
            </button>
        `).join('');

        const container = document.getElementById('app-selector');
        if (container) {
            container.innerHTML = html;
        }
    }

    /**
     * Renderiza el workflow de pasos
     */
    function renderWorkflow(apps) {
        const html = Object.entries(apps).map(([key, app]) => `
            <div class="step" data-step="${app.order}">
                <div class="step-number">${app.order}</div>
                <div class="step-label">${app.name}</div>
                <div class="step-name">${app.description}</div>
            </div>
        `).join('');

        const container = document.getElementById('workflow-steps');
        if (container) {
            container.innerHTML = html;
        }

        // Event listeners
        container.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', () => {
                const stepNum = step.dataset.step;
                const appKey = Object.keys(apps).find(k => apps[k].order === parseInt(stepNum));
                if (appKey) {
                    AppOrchestrator.openApp(appKey);
                }
            });
        });
    }

    /**
     * Muestra un modal
     */
    function showModal(title, content) {
        const modal = document.getElementById('modal');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');

        titleEl.textContent = title;
        bodyEl.innerHTML = content;

        modal.classList.add('show');
        modal.classList.add('fade-in');
    }

    /**
     * Cierra el modal (ya disponible en el HTML)
     */
    function closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.remove('show');
        modal.classList.remove('fade-in');
    }

    /**
     * Muestra una notificación toast
     */
    function showToast(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.375rem;
            box-shadow: 0 10px 15px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Actualiza el título del canvas
     */
    function updateCanvasTitle(title, badge) {
        const titleEl = document.getElementById('canvas-title');
        const badgeEl = document.getElementById('canvas-badge');

        if (titleEl) titleEl.textContent = title;
        if (badgeEl) {
            badgeEl.textContent = badge;
            badgeEl.className = 'badge badge-info';
        }
    }

    /**
     * Actualiza el contenido del canvas
     */
    function updateCanvasContent(html) {
        const content = document.getElementById('canvas-content');
        if (content) {
            content.innerHTML = html;
            content.classList.add('fade-in');
        }
    }

    /**
     * Renderiza una tabla de datos
     */
    function renderDataTable(data) {
        if (!data || typeof data !== 'object') {
            return '<p style="color: #6b7280;">Formato de datos no válido</p>';
        }

        const entries = Object.entries(data);
        const html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                <thead>
                    <tr style="background: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
                        <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Propiedad</th>
                        <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([key, value]) => `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 0.75rem; font-weight: 500;">${key}</td>
                            <td style="padding: 0.75rem; color: #6b7280;">
                                ${typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : value}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return html;
    }

    /**
     * Crea un gráfico simple
     */
    function createChart(canvasId, type, labels, datasets) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        if (window.Chart && window.Chart.instances && window.Chart.instances[canvasId]) {
            window.Chart.instances[canvasId].destroy();
        }

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });

        if (!window.Chart.instances) window.Chart.instances = {};
        window.Chart.instances[canvasId] = chart;

        return chart;
    }

    /**
     * Muestra información de carga
     */
    function showLoading(message = 'Cargando...') {
        updateCanvasContent(`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-size: 3rem; margin-bottom: 1rem; animation: spin 2s linear infinite;">⏳</div>
                <p style="font-size: 1.125rem; color: #6b7280;">${message}</p>
            </div>
            <style>
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            </style>
        `);
    }

    /**
     * Muestra un error
     */
    function showError(title, message) {
        updateCanvasContent(`
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="font-size: 1.25rem; font-weight: 600; color: #ef4444; margin-bottom: 0.5rem;">${title}</h3>
                <p style="color: #6b7280; text-align: center; max-width: 400px;">${message}</p>
            </div>
        `);
    }

    /**
     * Renderiza un formulario
     */
    function renderForm(fields) {
        const html = fields.map(field => `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; font-weight: 500; margin-bottom: 0.5rem;">${field.label}</label>
                ${field.type === 'select' ? `
                    <select style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.375rem;">
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                ` : `
                    <input type="${field.type || 'text'}" placeholder="${field.placeholder || ''}" 
                        style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.375rem;"/>
                `}
            </div>
        `).join('');

        return html;
    }

    /**
     * Renderiza una progresión
     */
    function renderProgress(current, total) {
        const percentage = (current / total) * 100;
        return `
            <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #2563eb, #059669); transition: width 0.3s ease;"></div>
            </div>
            <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280; text-align: center;">
                ${current} / ${total}
            </p>
        `;
    }

    /**
     * API Pública
     */
    return {
        renderAppSelector,
        renderWorkflow,
        showModal,
        closeModal,
        showToast,
        updateCanvasTitle,
        updateCanvasContent,
        renderDataTable,
        createChart,
        showLoading,
        showError,
        renderForm,
        renderProgress
    };
})();
