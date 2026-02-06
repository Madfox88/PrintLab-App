import { useState } from 'react';
import './App.css';
import logoImage from './assets/logo.png';
import {
  LabelCalculator,
  FlowpackCalculator,
  CandyJarCalculator,
  CoronaUvCalculator,
  RollLengthCalculator,
} from './components';
import type { CalculatorTab } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<CalculatorTab>('label');

  const tabs: { id: CalculatorTab; label: string }[] = [
    { id: 'label', label: 'Label Calculator' },
    { id: 'flowpack', label: 'Flowpack Calculator' },
    { id: 'candyjar', label: 'Candy Jar Calculator' },
    { id: 'coronauv', label: 'Corona & UV Calculator' },
    { id: 'rolllength', label: 'Roll Length Calculator' },
  ];

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <img 
            src={logoImage} 
            alt="PrintLab Logo" 
            className="brand-logo"
          />
        </div>
        <div className="badge">PrintLab Calculator</div>
      </header>

      <div className="app-layout">
        <aside className="sidebar-nav">
          <div className="sidebar-title">Calculators</div>
          <nav className="calculator-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="content-panel">
          {activeTab === 'label' && <LabelCalculator />}
          {activeTab === 'flowpack' && <FlowpackCalculator />}
          {activeTab === 'candyjar' && <CandyJarCalculator />}
          {activeTab === 'coronauv' && <CoronaUvCalculator />}
          {activeTab === 'rolllength' && <RollLengthCalculator />}
        </main>
      </div>
    </div>
  );
}

export default App;
