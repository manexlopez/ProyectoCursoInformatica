/**
 * DataManager.js
 * 
 * Gestor centralizado de datos del localStorage.
 * Proporciona una interfaz consistente para leer/escribir datos entre aplicaciones.
 */

const DataManager = (() => {
    const PREFIX = 'suite_thermal_';
    const STORAGE_KEYS = {
        trayectorias: 'suite_thermal_trayectorias',
        enriched: 'suite_thermal_data_enriched',
        ambient: 'suite_thermal_data_with_ambient',
        final: 'suite_thermal_final_setup'
    };

    /**
     * Guarda datos en localStorage
     */
    function set(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            console.log(`✓ Datos guardados: ${key} (${(serialized.length / 1024).toFixed(2)} KB)`);
            return true;
        } catch (error) {
            console.error(`✗ Error guardando ${key}:`, error);
            return false;
        }
    }

    /**
     * Obtiene datos de localStorage
     */
    function get(key) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.error(`✗ Error leyendo ${key}:`, error);
            return null;
        }
    }

    /**
     * Verifica si existen datos
     */
    function has(key) {
        return localStorage.getItem(key) !== null;
    }

    /**
     * Elimina datos
     */
    function remove(key) {
        try {
            localStorage.removeItem(key);
            console.log(`✓ Datos eliminados: ${key}`);
            return true;
        } catch (error) {
            console.error(`✗ Error eliminando ${key}:`, error);
            return false;
        }
    }

    /**
     * Limpia todos los datos de la suite
     */
    function clearAll() {
        try {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            console.log('✓ Todos los datos eliminados');
            return true;
        } catch (error) {
            console.error('✗ Error limpiando datos:', error);
            return false;
        }
    }

    /**
     * Exporta todos los datos
     */
    function exportAll() {
        const data = {};
        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const value = get(key);
            if (value) {
                data[name] = value;
            }
        });
        return data;
    }

    /**
     * Importa datos completos
     */
    function importAll(data) {
        try {
            Object.entries(data).forEach(([name, value]) => {
                const key = STORAGE_KEYS[name];
                if (key) {
                    set(key, value);
                }
            });
            console.log('✓ Datos importados exitosamente');
            return true;
        } catch (error) {
            console.error('✗ Error importando datos:', error);
            return false;
        }
    }

    /**
     * Obtiene estadísticas del almacenamiento
     */
    function getStats() {
        const stats = {
            totalSize: 0,
            apps: {},
            lastUpdate: null
        };

        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const data = get(key);
            if (data) {
                const size = JSON.stringify(data).length;
                stats.apps[name] = {
                    key,
                    size,
                    sizeKB: (size / 1024).toFixed(2),
                    hasData: true
                };
                stats.totalSize += size;
            } else {
                stats.apps[name] = {
                    key,
                    size: 0,
                    hasData: false
                };
            }
        });

        stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
        stats.lastUpdate = new Date().toISOString();

        return stats;
    }

    /**
     * Obtiene el estado de completitud
     */
    function getCompletionStatus() {
        const status = {
            completed: 0,
            total: Object.keys(STORAGE_KEYS).length,
            percentage: 0,
            apps: {}
        };

        Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
            const hasData = has(key);
            status.apps[name] = hasData;
            if (hasData) status.completed++;
        });

        status.percentage = (status.completed / status.total) * 100;
        return status;
    }

    /**
     * Obtiene una preview de los datos
     */
    function getPreview(key, maxLines = 10) {
        const data = get(key);
        if (!data) return 'Sin datos';

        const json = JSON.stringify(data, null, 2);
        const lines = json.split('\n');
        
        if (lines.length > maxLines) {
            return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} líneas más)`;
        }
        
        return json;
    }

    /**
     * Valida que una app tenga todas sus dependencias
     */
    function validateDependencies(appDependencies) {
        const missing = [];
        
        Object.entries(appDependencies).forEach(([key, isRequired]) => {
            if (isRequired && !has(key)) {
                missing.push(key);
            }
        });

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Obtiene la cadena de datos App1 → App2 → App3 → App4
     */
    function getDataChain() {
        return {
            app1: get(STORAGE_KEYS.trayectorias),
            app2: get(STORAGE_KEYS.enriched),
            app3: get(STORAGE_KEYS.ambient),
            app4: get(STORAGE_KEYS.final)
        };
    }

    /**
     * Obtiene el tamaño total en bytes
     */
    function getTotalSize() {
        return Object.values(STORAGE_KEYS).reduce((sum, key) => {
            const data = get(key);
            return sum + (data ? JSON.stringify(data).length : 0);
        }, 0);
    }

    /**
     * Obtiene el tamaño total en KB
     */
    function getTotalSizeKB() {
        return (getTotalSize() / 1024).toFixed(2);
    }

    /**
     * API Pública
     */
    return {
        // CRUD básico
        set,
        get,
        has,
        remove,
        
        // Batch operations
        clearAll,
        exportAll,
        importAll,
        
        // Información
        getStats,
        getCompletionStatus,
        getPreview,
        getDataChain,
        getTotalSize,
        getTotalSizeKB,
        
        // Validación
        validateDependencies,
        
        // Keys
        STORAGE_KEYS
    };
})();
