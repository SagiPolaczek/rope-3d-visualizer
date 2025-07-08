class RopeVisualizer {
    constructor() {
        this.canvas = null;
        this.visualization = null;
        this.uiControls = null;
        this.stepManager = null;
        this.loadingOverlay = null;
        
        this.state = {
            isInitialized: false,
            isLoading: true,
            currentStep: 0,
            isAnimating: false,
            parameters: {
                t_len: 16,
                h_len: 30,
                w_len: 60,
                dim: 128,
                theta: 10000,
                timeSlice: 0,
                animationSpeed: 1.0,
                quality: 2
            }
        };
        
        this.performanceMonitor = {
            fps: 60,
            frameCount: 0,
            lastTime: performance.now(),
            updateInterval: 1000
        };
        
        this.resizeObserver = null;
        this.animationId = null;
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            
            await this.initializeComponents();
            await this.setupEventListeners();
            await this.setupResizeObserver();
            
            // this.registerServiceWorker();
            
            this.state.isInitialized = true;
            this.state.isLoading = false;
            
            this.hideLoading();
            this.updateVisualization();
            
            console.log('RoPE Visualizer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize RoPE Visualizer:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    async initializeComponents() {
        this.canvas = document.getElementById('canvas');
        this.loadingOverlay = document.getElementById('loading-overlay');
        
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }
        
        this.visualization = new Visualization(this.canvas);
        this.uiControls = new UIControls();
        this.stepManager = new StepManager();
        
        this.setupCallbacks();
        
        return new Promise(resolve => {
            setTimeout(resolve, 100);
        });
    }

    setupCallbacks() {
        this.uiControls.setCallback('parameterChange', (params) => {
            this.state.parameters = { ...this.state.parameters, ...params };
            this.updateVisualization();
        });

        this.uiControls.setCallback('stepChange', (step) => {
            this.state.currentStep = step;
            this.stepManager.setStep(step);
            this.updateVisualization();
        });

        this.uiControls.setCallback('playPause', (isPlaying) => {
            this.state.isAnimating = isPlaying;
            if (isPlaying) {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
        });

        this.uiControls.setCallback('reset', () => {
            this.resetApplication();
        });

        this.uiControls.setCallback('export', () => {
            this.exportImage();
        });

        this.uiControls.setCallback('fullscreen', () => {
            this.toggleFullscreen();
        });

        this.stepManager.setCallback('stepChange', (stepId, stepData) => {
            this.state.currentStep = stepId;
            this.updateVisualization();
        });
        
        this.canvas.addEventListener('performance-update', (e) => {
            this.performanceMonitor.fps = e.detail.fps;
            this.uiControls.updatePerformanceDisplay(e.detail.fps, e.detail.pointCount);
        });
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAnimation();
            } else if (this.state.isAnimating) {
                this.startAnimation();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    this.adjustParameter('quality', 1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.adjustParameter('quality', -1);
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    this.adjustParameter('animationSpeed', 0.1);
                    break;
                case '-':
                    e.preventDefault();
                    this.adjustParameter('animationSpeed', -0.1);
                    break;
            }
        });

        window.addEventListener('error', (e) => {
            console.error('Runtime error:', e.error);
            this.showError('An error occurred. Please check the console for details.');
        });
    }

    setupResizeObserver() {
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.canvas);
        }
    }

    updateVisualization() {
        if (!this.state.isInitialized || this.state.isLoading) return;
        
        try {
            const stepData = ropeMathNew.getStepData(this.state.currentStep, this.state.parameters);
            
            console.log(`RoPE Tensor: t_len=${this.state.parameters.t_len}, h_len=${this.state.parameters.h_len}, w_len=${this.state.parameters.w_len}`);
            console.log(`Generated ${stepData?.length || 0} data points (should be ${this.state.parameters.t_len * this.state.parameters.h_len * this.state.parameters.w_len})`);
            
            if (stepData && stepData.length > 0) {
                // Update camera positioning for the current tensor dimensions
                this.visualization.updateCameraForTensor(
                    this.state.parameters.t_len,
                    this.state.parameters.h_len,
                    this.state.parameters.w_len
                );
                
                this.visualization.updateVisualization(stepData, this.state.currentStep);
                
                if (this.state.currentStep === 2 && this.state.isAnimating) {
                    this.visualization.startAnimation();
                } else {
                    this.visualization.stopAnimation();
                }
                
                this.visualization.setAnimationSpeed(this.state.parameters.animationSpeed);
            }
            
        } catch (error) {
            console.error('Error updating visualization:', error);
            this.showError('Failed to update visualization');
        }
    }

    startAnimation() {
        if (this.state.isAnimating) return;
        
        this.state.isAnimating = true;
        this.visualization.startAnimation();
        
        if (this.state.currentStep === 2) {
            this.animateTimeSlice();
        }
    }

    stopAnimation() {
        this.state.isAnimating = false;
        this.visualization.stopAnimation();
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    pauseAnimation() {
        if (this.state.isAnimating) {
            this.visualization.stopAnimation();
        }
    }

    animateTimeSlice() {
        if (!this.state.isAnimating) return;
        
        const animate = () => {
            if (!this.state.isAnimating) return;
            
            this.state.parameters.timeSlice = 
                (this.state.parameters.timeSlice + this.state.parameters.animationSpeed * 0.1) % 
                this.state.parameters.t_len;
            
            this.updateVisualization();
            this.uiControls.setParameters({ timeSlice: Math.floor(this.state.parameters.timeSlice) });
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    resetApplication() {
        this.stopAnimation();
        
        this.state.parameters = {
            t_len: 16,
            h_len: 30,
            w_len: 60,
            dim: 128,
            theta: 10000,
            timeSlice: 0,
            animationSpeed: 1.0,
            quality: 2
        };
        
        this.state.currentStep = 0;
        this.state.isAnimating = false;
        
        this.stepManager.setStep(0);
        this.visualization.resetCamera();
        this.updateVisualization();
        
        this.uiControls.showToast('Application reset successfully', 'success');
    }

    adjustParameter(param, delta) {
        const current = this.state.parameters[param];
        let newValue = current + delta;
        
        switch (param) {
            case 'quality':
                newValue = Math.max(1, Math.min(3, Math.round(newValue)));
                break;
            case 'animationSpeed':
                newValue = Math.max(0.1, Math.min(3.0, Math.round(newValue * 10) / 10));
                break;
        }
        
        if (newValue !== current) {
            this.state.parameters[param] = newValue;
            this.uiControls.setParameters({ [param]: newValue });
            this.updateVisualization();
        }
    }

    exportImage() {
        try {
            const dataURL = this.visualization.exportImage();
            const link = document.createElement('a');
            link.download = `rope-3d-step-${this.state.currentStep + 1}-${Date.now()}.png`;
            link.href = dataURL;
            link.click();
            
            this.uiControls.showToast('Image exported successfully', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.uiControls.showToast('Export failed', 'error');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Fullscreen request failed:', err);
                this.uiControls.showToast('Fullscreen not supported', 'warning');
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('Exit fullscreen failed:', err);
            });
        }
    }

    handleResize() {
        if (this.visualization) {
            this.visualization.resize();
        }
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    showError(message) {
        console.error(message);
        
        if (this.loadingOverlay) {
            this.loadingOverlay.innerHTML = `
                <div class="error-message">
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="btn btn-primary">Reload Page</button>
                </div>
            `;
            this.loadingOverlay.classList.remove('hidden');
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }

    cleanup() {
        this.stopAnimation();
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.visualization) {
            this.visualization.dispose();
        }
        
        ropeMath.clearCache();
    }

    getState() {
        return {
            ...this.state,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    setState(state) {
        if (state.parameters) {
            this.state.parameters = { ...this.state.parameters, ...state.parameters };
            this.uiControls.setParameters(this.state.parameters);
        }
        
        if (typeof state.currentStep === 'number') {
            this.state.currentStep = state.currentStep;
            this.stepManager.setStep(state.currentStep);
        }
        
        if (typeof state.isAnimating === 'boolean') {
            this.state.isAnimating = state.isAnimating;
            if (state.isAnimating) {
                this.startAnimation();
            } else {
                this.stopAnimation();
            }
        }
        
        this.updateVisualization();
    }

    exportState() {
        const state = this.getState();
        const dataStr = JSON.stringify(state, null, 2);
        const dataURI = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataURI);
        link.setAttribute('download', `rope-3d-state-${Date.now()}.json`);
        link.click();
    }

    importState(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                this.setState(state);
                this.uiControls.showToast('State imported successfully', 'success');
            } catch (error) {
                console.error('Import failed:', error);
                this.uiControls.showToast('Import failed', 'error');
            }
        };
        reader.readAsText(file);
    }

    getPerformanceMetrics() {
        return {
            fps: this.performanceMonitor.fps,
            pointCount: this.visualization ? this.visualization.instancedMesh.count : 0,
            cacheInfo: ropeMath.getCacheInfo(),
            memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ropeVisualizer = new RopeVisualizer();
});

window.addEventListener('load', () => {
    if (window.ropeVisualizer && window.ropeVisualizer.state.isInitialized) {
        console.log('RoPE Visualizer fully loaded');
        
        if (window.ropeVisualizer.uiControls) {
            window.ropeVisualizer.uiControls.showToast('RoPE Visualizer ready!', 'success');
        }
    }
});

// Service worker disabled for local development
// if ('serviceWorker' in navigator) {
//     window.addEventListener('load', () => {
//         navigator.serviceWorker.register('./sw.js');
//     });
// }