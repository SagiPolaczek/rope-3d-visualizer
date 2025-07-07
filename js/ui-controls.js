class UIControls {
    constructor() {
        this.elements = {};
        this.parameters = {
            t_len: 16,
            h_len: 30,
            w_len: 60,
            dim: 128,
            theta: 10,
            timeSlice: 0,
            animationSpeed: 1.0,
            quality: 2
        };
        
        this.callbacks = {
            parameterChange: null,
            stepChange: null,
            playPause: null,
            reset: null,
            export: null,
            fullscreen: null
        };
        
        this.isPlaying = false;
        this.currentStep = 0;
        this.totalSteps = 4;
        
        this.init();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.updateParameterDisplays();
        this.updateStepDisplay();
    }

    bindElements() {
        this.elements = {
            timeSlider: document.getElementById('time-slider'),
            timeValue: document.getElementById('time-value'),
            heightSlider: document.getElementById('height-slider'),
            heightValue: document.getElementById('height-value'),
            widthSlider: document.getElementById('width-slider'),
            widthValue: document.getElementById('width-value'),
            dimSlider: document.getElementById('dim-slider'),
            dimValue: document.getElementById('dim-value'),
            thetaSlider: document.getElementById('theta-slider'),
            thetaValue: document.getElementById('theta-value'),
            timeSliceSlider: document.getElementById('time-slice-slider'),
            timeSliceValue: document.getElementById('time-slice-value'),
            speedSlider: document.getElementById('speed-slider'),
            speedValue: document.getElementById('speed-value'),
            qualitySlider: document.getElementById('quality-slider'),
            qualityValue: document.getElementById('quality-value'),
            
            prevStepBtn: document.getElementById('prev-step'),
            nextStepBtn: document.getElementById('next-step'),
            currentStepSpan: document.getElementById('current-step'),
            totalStepsSpan: document.getElementById('total-steps'),
            
            playPauseBtn: document.getElementById('play-pause-btn'),
            resetBtn: document.getElementById('reset-btn'),
            exportBtn: document.getElementById('export-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            
            helpBtn: document.getElementById('help-btn'),
            aboutBtn: document.getElementById('about-btn'),
            
            helpModal: document.getElementById('help-modal'),
            aboutModal: document.getElementById('about-modal'),
            
            fpsCounter: document.getElementById('fps-counter'),
            pointCounter: document.getElementById('point-counter')
        };
    }

    bindEvents() {
        this.bindParameterSliders();
        this.bindStepControls();
        this.bindActionButtons();
        this.bindModalControls();
        this.bindKeyboardShortcuts();
    }

    bindParameterSliders() {
        const sliders = [
            { element: this.elements.timeSlider, param: 't_len', display: this.elements.timeValue },
            { element: this.elements.heightSlider, param: 'h_len', display: this.elements.heightValue },
            { element: this.elements.widthSlider, param: 'w_len', display: this.elements.widthValue },
            { element: this.elements.dimSlider, param: 'dim', display: this.elements.dimValue },
            { element: this.elements.thetaSlider, param: 'theta', display: this.elements.thetaValue },
            { element: this.elements.timeSliceSlider, param: 'timeSlice', display: this.elements.timeSliceValue },
            { element: this.elements.speedSlider, param: 'animationSpeed', display: this.elements.speedValue },
            { element: this.elements.qualitySlider, param: 'quality', display: this.elements.qualityValue }
        ];

        sliders.forEach(({ element, param, display }) => {
            if (!element) return;
            
            element.addEventListener('input', (e) => {
                let value = parseFloat(e.target.value);
                
                if (param === 'theta') {
                    value = value * 1000;
                }
                
                this.parameters[param] = value;
                this.updateParameterDisplay(param, value, display);
                this.updateDependentParameters(param, value);
                
                if (this.callbacks.parameterChange) {
                    this.callbacks.parameterChange(this.parameters);
                }
            });
            
            element.addEventListener('change', (e) => {
                this.triggerHapticFeedback();
            });
        });
    }

    bindStepControls() {
        if (this.elements.prevStepBtn) {
            this.elements.prevStepBtn.addEventListener('click', () => {
                this.previousStep();
            });
        }

        if (this.elements.nextStepBtn) {
            this.elements.nextStepBtn.addEventListener('click', () => {
                this.nextStep();
            });
        }
    }

    bindActionButtons() {
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }

        if (this.elements.resetBtn) {
            this.elements.resetBtn.addEventListener('click', () => {
                this.reset();
            });
        }

        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => {
                this.exportImage();
            });
        }

        if (this.elements.fullscreenBtn) {
            this.elements.fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
    }

    bindModalControls() {
        if (this.elements.helpBtn) {
            this.elements.helpBtn.addEventListener('click', () => {
                this.showModal('help');
            });
        }

        if (this.elements.aboutBtn) {
            this.elements.aboutBtn.addEventListener('click', () => {
                this.showModal('about');
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-close')) {
                this.hideModals();
            }
            
            if (e.target.classList.contains('modal')) {
                this.hideModals();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideModals();
            }
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.previousStep();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextStep();
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.reset();
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case 'h':
                case 'H':
                    e.preventDefault();
                    this.showModal('help');
                    break;
                case 'i':
                case 'I':
                    e.preventDefault();
                    this.showModal('about');
                    break;
            }
        });
    }

    updateParameterDisplay(param, value, displayElement) {
        if (!displayElement) return;
        
        let displayValue = value;
        
        switch (param) {
            case 'theta':
                displayValue = Math.round(value / 1000);
                break;
            case 'animationSpeed':
                displayValue = value.toFixed(1);
                break;
            case 'quality':
                const qualityLabels = ['Low', 'Medium', 'High'];
                displayValue = qualityLabels[value - 1] || 'Medium';
                break;
            default:
                displayValue = Math.round(value);
        }
        
        displayElement.textContent = displayValue;
    }

    updateParameterDisplays() {
        this.updateParameterDisplay('t_len', this.parameters.t_len, this.elements.timeValue);
        this.updateParameterDisplay('h_len', this.parameters.h_len, this.elements.heightValue);
        this.updateParameterDisplay('w_len', this.parameters.w_len, this.elements.widthValue);
        this.updateParameterDisplay('dim', this.parameters.dim, this.elements.dimValue);
        this.updateParameterDisplay('theta', this.parameters.theta * 1000, this.elements.thetaValue);
        this.updateParameterDisplay('timeSlice', this.parameters.timeSlice, this.elements.timeSliceValue);
        this.updateParameterDisplay('animationSpeed', this.parameters.animationSpeed, this.elements.speedValue);
        this.updateParameterDisplay('quality', this.parameters.quality, this.elements.qualityValue);
    }

    updateDependentParameters(param, value) {
        if (param === 't_len') {
            const maxTimeSlice = Math.max(0, value - 1);
            if (this.elements.timeSliceSlider) {
                this.elements.timeSliceSlider.max = maxTimeSlice;
                if (this.parameters.timeSlice > maxTimeSlice) {
                    this.parameters.timeSlice = maxTimeSlice;
                    this.elements.timeSliceSlider.value = maxTimeSlice;
                    this.updateParameterDisplay('timeSlice', maxTimeSlice, this.elements.timeSliceValue);
                }
            }
        }
    }

    updateStepDisplay() {
        if (this.elements.currentStepSpan) {
            this.elements.currentStepSpan.textContent = this.currentStep + 1;
        }
        
        if (this.elements.totalStepsSpan) {
            this.elements.totalStepsSpan.textContent = this.totalSteps;
        }
        
        if (this.elements.prevStepBtn) {
            this.elements.prevStepBtn.disabled = this.currentStep === 0;
        }
        
        if (this.elements.nextStepBtn) {
            this.elements.nextStepBtn.disabled = this.currentStep === this.totalSteps - 1;
        }
    }

    setStep(step) {
        this.currentStep = Math.max(0, Math.min(step, this.totalSteps - 1));
        this.updateStepDisplay();
        
        if (this.callbacks.stepChange) {
            this.callbacks.stepChange(this.currentStep);
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.setStep(this.currentStep - 1);
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps - 1) {
            this.setStep(this.currentStep + 1);
        }
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        
        if (this.elements.playPauseBtn) {
            const icon = this.elements.playPauseBtn.querySelector('.icon');
            const text = this.elements.playPauseBtn.querySelector('.btn-text');
            
            if (this.isPlaying) {
                if (icon) icon.textContent = '⏸';
                if (text) text.textContent = 'Pause';
            } else {
                if (icon) icon.textContent = '▶';
                if (text) text.textContent = 'Play';
            }
        }
        
        if (this.callbacks.playPause) {
            this.callbacks.playPause(this.isPlaying);
        }
    }

    reset() {
        this.parameters = {
            t_len: 16,
            h_len: 30,
            w_len: 60,
            dim: 128,
            theta: 10000,
            timeSlice: 0,
            animationSpeed: 1.0,
            quality: 2
        };
        
        this.currentStep = 0;
        this.isPlaying = false;
        
        this.updateSliderValues();
        this.updateParameterDisplays();
        this.updateStepDisplay();
        this.updatePlayPauseButton();
        
        if (this.callbacks.reset) {
            this.callbacks.reset();
        }
        
        if (this.callbacks.parameterChange) {
            this.callbacks.parameterChange(this.parameters);
        }
        
        if (this.callbacks.stepChange) {
            this.callbacks.stepChange(this.currentStep);
        }
    }

    updateSliderValues() {
        if (this.elements.timeSlider) this.elements.timeSlider.value = this.parameters.t_len;
        if (this.elements.heightSlider) this.elements.heightSlider.value = this.parameters.h_len;
        if (this.elements.widthSlider) this.elements.widthSlider.value = this.parameters.w_len;
        if (this.elements.dimSlider) this.elements.dimSlider.value = this.parameters.dim;
        if (this.elements.thetaSlider) this.elements.thetaSlider.value = this.parameters.theta / 1000;
        if (this.elements.timeSliceSlider) this.elements.timeSliceSlider.value = this.parameters.timeSlice;
        if (this.elements.speedSlider) this.elements.speedSlider.value = this.parameters.animationSpeed;
        if (this.elements.qualitySlider) this.elements.qualitySlider.value = this.parameters.quality;
    }

    updatePlayPauseButton() {
        if (this.elements.playPauseBtn) {
            const icon = this.elements.playPauseBtn.querySelector('.icon');
            const text = this.elements.playPauseBtn.querySelector('.btn-text');
            
            if (icon) icon.textContent = '▶';
            if (text) text.textContent = 'Play';
        }
    }

    exportImage() {
        if (this.callbacks.export) {
            this.callbacks.export();
        }
    }

    toggleFullscreen() {
        if (this.callbacks.fullscreen) {
            this.callbacks.fullscreen();
        }
    }

    showModal(type) {
        this.hideModals();
        
        let modal = null;
        if (type === 'help') {
            modal = this.elements.helpModal;
        } else if (type === 'about') {
            modal = this.elements.aboutModal;
        }
        
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    hideModals() {
        [this.elements.helpModal, this.elements.aboutModal].forEach(modal => {
            if (modal) {
                modal.classList.remove('active');
            }
        });
        document.body.style.overflow = '';
    }

    updatePerformanceDisplay(fps, pointCount) {
        if (this.elements.fpsCounter) {
            this.elements.fpsCounter.textContent = fps;
        }
        
        if (this.elements.pointCounter) {
            this.elements.pointCounter.textContent = pointCount.toLocaleString();
        }
    }

    triggerHapticFeedback() {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    setCallback(type, callback) {
        if (this.callbacks.hasOwnProperty(type)) {
            this.callbacks[type] = callback;
        }
    }

    getParameters() {
        return { ...this.parameters };
    }

    setParameters(params) {
        this.parameters = { ...this.parameters, ...params };
        this.updateSliderValues();
        this.updateParameterDisplays();
    }

    getCurrentStep() {
        return this.currentStep;
    }

    isAnimationPlaying() {
        return this.isPlaying;
    }

    disable() {
        const allInputs = document.querySelectorAll('input, button');
        allInputs.forEach(input => {
            input.disabled = true;
        });
    }

    enable() {
        const allInputs = document.querySelectorAll('input, button');
        allInputs.forEach(input => {
            input.disabled = false;
        });
        
        this.updateStepDisplay();
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--surface-color);
            color: var(--text-color);
            padding: 12px 24px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideInUp 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

window.UIControls = UIControls;