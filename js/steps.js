class StepManager {
    constructor() {
        this.steps = [
            {
                id: 0,
                title: '3D RoPE Encoding',
                description: 'Complete Rotary Position Encoding for 3D coordinates [t, h, w]',
                code: `# Complete 3D RoPE Implementation
def rope(pos: Tensor, dim: int, theta: int) -> Tensor:
    assert dim % 2 == 0
    scale = torch.linspace(0, (dim - 2) / dim, steps=dim//2)
    omega = 1.0 / (theta**scale)
    out = torch.einsum("...n,d->...nd", pos, omega)
    out = torch.stack([torch.cos(out), -torch.sin(out), 
                       torch.sin(out), torch.cos(out)], dim=-1)
    return rearrange(out, "b n d (i j) -> b n d i j", i=2, j=2)

# Apply to 3D coordinates
freqs_t = rope(t_coords, axes_dim[0], theta)  # Time encoding
freqs_h = rope(h_coords, axes_dim[1], theta)  # Height encoding  
freqs_w = rope(w_coords, axes_dim[2], theta)  # Width encoding

# Concatenate all encodings
freqs = torch.cat([freqs_t, freqs_h, freqs_w], dim=-3)`,
                explanation: 'Each 3D position gets encoded as rotation matrices that capture relative positional relationships across time, height, and width dimensions.',
                colorLegend: {
                    red: 'Time dimension encoding (T)',
                    green: 'Height dimension encoding (H)', 
                    blue: 'Width dimension encoding (W)',
                    arrows: 'Rotation matrix vectors',
                    spheres: 'Encoding magnitude'
                }
            }
        ];
        
        this.currentStep = 0;
        this.elements = {};
        this.callbacks = {};
        
        this.init();
    }

    init() {
        this.bindElements();
        this.updateStepDisplay();
    }

    bindElements() {
        this.elements = {
            stepTitle: document.getElementById('step-title'),
            stepDescription: document.getElementById('step-description'),
            stepCode: document.getElementById('step-code'),
            currentStep: document.getElementById('current-step'),
            totalSteps: document.getElementById('total-steps')
        };
    }

    setStep(stepId) {
        this.currentStep = Math.max(0, Math.min(stepId, this.steps.length - 1));
        this.updateStepDisplay();
        
        if (this.callbacks.stepChange) {
            this.callbacks.stepChange(this.currentStep, this.getCurrentStep());
        }
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.setStep(this.currentStep + 1);
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.setStep(this.currentStep - 1);
        }
    }

    getCurrentStep() {
        return this.steps[this.currentStep];
    }

    getAllSteps() {
        return this.steps;
    }

    updateStepDisplay() {
        const step = this.getCurrentStep();
        
        if (this.elements.stepTitle) {
            this.elements.stepTitle.textContent = step.title;
        }
        
        if (this.elements.stepDescription) {
            this.elements.stepDescription.textContent = step.description;
        }
        
        if (this.elements.stepCode) {
            this.elements.stepCode.textContent = step.code;
        }
        
        if (this.elements.currentStep) {
            this.elements.currentStep.textContent = this.currentStep + 1;
        }
        
        if (this.elements.totalSteps) {
            this.elements.totalSteps.textContent = this.steps.length;
        }
        
        this.updateStepProgress();
        this.updateColorLegend();
    }

    updateStepProgress() {
        const progressElements = document.querySelectorAll('.step-dot');
        progressElements.forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            
            if (index < this.currentStep) {
                dot.classList.add('completed');
            } else if (index === this.currentStep) {
                dot.classList.add('active');
            }
        });
        
        const progressLines = document.querySelectorAll('.step-line');
        progressLines.forEach((line, index) => {
            line.classList.remove('completed');
            
            if (index < this.currentStep) {
                line.classList.add('completed');
            }
        });
    }

    updateColorLegend() {
        const legendElement = document.querySelector('.legend');
        if (!legendElement) return;
        
        const step = this.getCurrentStep();
        const legendItems = legendElement.querySelector('.legend-items');
        
        if (legendItems) {
            legendItems.innerHTML = '';
            
            Object.entries(step.colorLegend).forEach(([key, value]) => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                
                const color = document.createElement('div');
                color.className = 'legend-color';
                
                const label = document.createElement('span');
                label.className = 'legend-label';
                label.textContent = value;
                
                switch (key) {
                    case 'red':
                        color.style.backgroundColor = '#ff4444';
                        break;
                    case 'green':
                        color.style.backgroundColor = '#44ff44';
                        break;
                    case 'blue':
                        color.style.backgroundColor = '#4444ff';
                        break;
                    case 'hue':
                        color.style.background = 'linear-gradient(45deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';
                        break;
                    case 'spectrum':
                        color.style.background = 'linear-gradient(45deg, #4CAF50, #2196F3, #FF9800, #E91E63)';
                        break;
                    case 'motion':
                        color.style.background = 'radial-gradient(circle, #4CAF50, #81C784)';
                        break;
                    case 'trails':
                        color.style.background = 'conic-gradient(#4CAF50, #81C784, #4CAF50)';
                        break;
                    case 'brightness':
                        color.style.background = 'linear-gradient(45deg, #333, #fff)';
                        break;
                    case 'variation':
                        color.style.background = 'linear-gradient(45deg, #000, #4CAF50, #fff)';
                        break;
                    default:
                        color.style.backgroundColor = '#4CAF50';
                }
                
                item.appendChild(color);
                item.appendChild(label);
                legendItems.appendChild(item);
            });
        }
    }

    getStepData(stepId, parameters) {
        const step = this.steps[stepId];
        if (!step) return null;
        
        return {
            id: step.id,
            title: step.title,
            description: step.description,
            code: step.code,
            explanation: step.explanation,
            colorLegend: step.colorLegend,
            parameters: parameters
        };
    }

    getStepInstructions(stepId) {
        const step = this.steps[stepId];
        if (!step) return null;
        
        return {
            title: step.title,
            description: step.description,
            implementation: this.getImplementationHints(stepId),
            visualization: this.getVisualizationHints(stepId)
        };
    }

    getImplementationHints(stepId) {
        const hints = {
            0: [
                'Create coordinate arrays for each dimension',
                'Use meshgrid to generate all position combinations',
                'Store positions as [t, h, w] coordinates',
                'Color code by normalized position values'
            ],
            1: [
                'Calculate frequency scales using linspace',
                'Apply power function with theta base',
                'Different frequencies for different dimensions',
                'Visualize frequency magnitude with color'
            ],
            2: [
                'Compute rotation angles using position * frequency',
                'Apply sin/cos functions for rotation matrices',
                'Animate rotation to show temporal evolution',
                'Show circular motion patterns'
            ],
            3: [
                'Concatenate all dimensional encodings',
                'Combine sin/cos pairs for each frequency',
                'Create final embedding vector',
                'Visualize encoding magnitude and diversity'
            ]
        };
        
        return hints[stepId] || [];
    }

    getVisualizationHints(stepId) {
        const hints = {
            0: [
                'Show 3D grid with RGB color coding',
                'Red for time, green for height, blue for width',
                'Display coordinate axes clearly',
                'Use transparency for depth perception'
            ],
            1: [
                'Color by frequency magnitude',
                'Use HSL color space for smooth transitions',
                'Show different scales across dimensions',
                'Indicate encoding strength with saturation'
            ],
            2: [
                'Animate circular rotation patterns',
                'Show rotation trails and paths',
                'Use time-based color variation',
                'Demonstrate relative position encoding'
            ],
            3: [
                'Show final encoding magnitude',
                'Use spectral color mapping',
                'Indicate information density',
                'Display encoding uniqueness across positions'
            ]
        };
        
        return hints[stepId] || [];
    }

    setCallback(event, callback) {
        this.callbacks[event] = callback;
    }

    exportStepData() {
        return {
            currentStep: this.currentStep,
            steps: this.steps,
            timestamp: new Date().toISOString()
        };
    }

    importStepData(data) {
        if (data.steps && Array.isArray(data.steps)) {
            this.steps = data.steps;
        }
        
        if (typeof data.currentStep === 'number') {
            this.setStep(data.currentStep);
        }
    }

    createStepNavigation() {
        const nav = document.createElement('div');
        nav.className = 'step-navigation';
        
        this.steps.forEach((step, index) => {
            const button = document.createElement('button');
            button.className = 'step-nav-button';
            button.textContent = `${index + 1}`;
            button.title = step.title;
            button.addEventListener('click', () => this.setStep(index));
            
            if (index === this.currentStep) {
                button.classList.add('active');
            }
            
            nav.appendChild(button);
        });
        
        return nav;
    }

    addCustomStep(step) {
        const stepId = this.steps.length;
        const newStep = {
            id: stepId,
            title: step.title || `Step ${stepId + 1}`,
            description: step.description || '',
            code: step.code || '',
            explanation: step.explanation || '',
            colorLegend: step.colorLegend || {}
        };
        
        this.steps.push(newStep);
        this.updateStepDisplay();
        
        return stepId;
    }

    removeStep(stepId) {
        if (stepId >= 0 && stepId < this.steps.length) {
            this.steps.splice(stepId, 1);
            
            this.steps.forEach((step, index) => {
                step.id = index;
            });
            
            if (this.currentStep >= this.steps.length) {
                this.currentStep = this.steps.length - 1;
            }
            
            this.updateStepDisplay();
        }
    }

    getStepTiming() {
        const baseDuration = 2000;
        const timings = {
            0: baseDuration,
            1: baseDuration * 1.5,
            2: baseDuration * 2,
            3: baseDuration * 1.2
        };
        
        return timings[this.currentStep] || baseDuration;
    }

    canProceedToStep(stepId) {
        if (stepId <= 0) return true;
        
        const prerequisites = {
            1: [0],
            2: [0, 1],
            3: [0, 1, 2]
        };
        
        const required = prerequisites[stepId] || [];
        return required.every(reqStep => reqStep < stepId);
    }

    getStepProgress() {
        return {
            current: this.currentStep,
            total: this.steps.length,
            percentage: ((this.currentStep + 1) / this.steps.length) * 100
        };
    }
}

window.StepManager = StepManager;