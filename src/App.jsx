import { useState } from "react";
import { classicsData } from "./data/classicsData";
import PhoneSimulator from "./components/PhoneSimulator";
import ScriptEditor from "./components/ScriptEditor";
import ResourceHub from "./components/ResourceHub";
import YouTubeMetadataGenerator from "./components/YouTubeMetadataGenerator";

function App() {
  const [activeClassicIndex, setActiveClassicIndex] = useState(0);
  const [activeScriptIndex, setActiveScriptIndex] = useState(0);

  const currentClassic = classicsData[activeClassicIndex];

  const handleClassicSelect = (index) => {
    setActiveClassicIndex(index);
    setActiveScriptIndex(0); // Reset script tone to first option
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1 className="app-logo">Clásicos en Corto</h1>
        <p className="app-subtitle">
          Creador de Guiones y Simulador de Video para Redes Sociales — Literatura Rusa en Español
        </p>
      </header>

      {/* Main Dashboard Layout */}
      <main className="dashboard-grid">
        {/* Sidebar: Classics Selector */}
        <aside className="sidebar">
          <div className="card-premium">
            <h3 className="section-title">
              <span className="sparkle">📚</span> Obras Clásicas
            </h3>
            <div className="classics-list">
              {classicsData.map((classic, index) => (
                <button
                  key={classic.id}
                  className={`classic-card-btn ${activeClassicIndex === index ? "active" : ""}`}
                  onClick={() => handleClassicSelect(index)}
                >
                  <h4 className="classic-title">{classic.title}</h4>
                  <p className="classic-author">{classic.author}</p>
                  <span className="classic-tag">{classic.mood.split(",")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Workspace: Preview and Script Management */}
        <section className="workspace-main">
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {/* Phone Simulator and Script Editor Side-by-Side in PhoneSimulator component */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
              <PhoneSimulator 
                classic={currentClassic} 
                activeScriptIndex={activeScriptIndex} 
              />
              
              <ScriptEditor 
                classic={currentClassic}
                activeScriptIndex={activeScriptIndex}
                setActiveScriptIndex={setActiveScriptIndex}
              />
            </div>

            {/* Strategic Resource Hub */}
            <ResourceHub classic={currentClassic} />

            {/* YouTube Metadata Generator */}
            <YouTubeMetadataGenerator classic={currentClassic} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
