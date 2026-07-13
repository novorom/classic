import { useState, useEffect } from "react";

export default function ScriptEditor({ classic, activeScriptIndex, setActiveScriptIndex }) {
  const scripts = classic.scripts;
  const currentScript = scripts[activeScriptIndex];
  
  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  // Initialize edited text when script/classic changes
  useEffect(() => {
    // Reconstruct single text script from subtitles
    const fullText = currentScript.subtitles.map(s => s.text).join("\n");
    setEditedText(fullText);
    setCopied(false);
  }, [classic, activeScriptIndex, currentScript.subtitles]);

  const handleCopy = () => {
    // Format text nicely for a teleprompter
    let teleprompterFormat = `--- GUION TELEPROMPTER: ${classic.title.toUpperCase()} (${currentScript.tone.toUpperCase()}) ---\n\n`;
    
    // Split lines by paragraphs
    const lines = editedText.split("\n");
    lines.forEach((line, index) => {
      if (index === 0) {
        teleprompterFormat += `[GANCHO - IMPACTO INICIAL]\n🔊 ${line}\n\n`;
      } else if (index === lines.length - 1) {
        teleprompterFormat += `[CTA - LLAMADA A LA ACCIÓN]\n🗣️ ${line}\n\n`;
      } else {
        if (index === 1) teleprompterFormat += `[CUERPO - DESARROLLO]\n📖 `;
        teleprompterFormat += `${line} `;
      }
    });

    teleprompterFormat += `\n\n--- SUGERENCIA DE PROMPT PARA VOZ IA ---\n`;
    if (classic.id === "crimen-y-castigo") {
      teleprompterFormat += `Voz: Masculina, madura, profunda, tono dramático y susurrante, ritmo pausado con tensión psicológica. Estilo documental.`;
    } else if (classic.id === "guerra-y-paz") {
      teleprompterFormat += `Voz: Masculina o Femenina, culta, elegante, tono épico y noble, ritmo medio, entonación cinematográfica.`;
    } else {
      teleprompterFormat += `Voz: Masculina, irónica, teatral, tono misterioso con sarcasmo sutil, ritmo dinámico.`;
    }

    navigator.clipboard.writeText(teleprompterFormat);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordsCount = editedText.split(/\s+/).filter(Boolean).length;
  const charsCount = editedText.length;
  const estimatedReadingTime = Math.ceil(wordsCount / 2.5); // avg 150 words per min (2.5 words per sec)

  return (
    <div className="script-editor-container card-premium">
      <h3 className="section-title">
        <span className="sparkle">✍️</span> Editor de Guion y Tono
      </h3>

      {/* Tone Selection */}
      <div className="tone-selector">
        <span className="selector-label">Selecciona el enfoque del video:</span>
        <div className="tones-list">
          {scripts.map((sc, idx) => (
            <button
              key={sc.tone}
              className={`tone-btn ${activeScriptIndex === idx ? "active" : ""}`}
              onClick={() => setActiveScriptIndex(idx)}
            >
              {sc.tone}
            </button>
          ))}
        </div>
      </div>

      {/* Text Editor Area */}
      <div className="editor-wrapper">
        <div className="editor-header">
          <span className="editor-badge hook-tag">Gancho</span>
          <span className="editor-badge body-tag">Cuerpo</span>
          <span className="editor-badge cta-tag">CTA</span>
        </div>
        
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="script-textarea"
          placeholder="Escribe el guion aquí, línea por línea..."
          rows={10}
        />
        
        <div className="editor-footer">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Palabras</span>
              <span className="stat-val">{wordsCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Caracteres</span>
              <span className="stat-val">{charsCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tiempo aprox.</span>
              <span className="stat-val">{estimatedReadingTime}s</span>
            </div>
          </div>

          <button 
            className={`copy-btn ${copied ? "copied" : ""}`} 
            onClick={handleCopy}
          >
            {copied ? "¡Copiado al portapapeles! ✓" : "Copiar Guion para Teleprompter"}
          </button>
        </div>
      </div>

      {/* AI Voice Prompt helper */}
      <div className="voice-prompt-card">
        <div className="voice-prompt-header">
          <span className="voice-icon">🎙️</span>
          <strong>Configuración de Voz (ElevenLabs / Lovo)</strong>
        </div>
        <p className="voice-prompt-text">
          {classic.id === "crimen-y-castigo" && (
            <><strong>Voz recomendada:</strong> Masculina, profunda, susurrante y con tensión psicológica. <em>"Estilo Raskólnikov"</em>.</>
          )}
          {classic.id === "guerra-y-paz" && (
            <><strong>Voz recomendada:</strong> Elegante, aristocrática, estilo documental histórico. Ritmo solemne.</>
          )}
          {classic.id === "el-maestro-y-margarita" && (
            <><strong>Voz recomendada:</strong> Irónica, misteriosa, con toques de sarcasmo y ritmo teatral acelerado.</>
          )}
        </p>
        <div className="prompt-copy-box">
          <code>
            {classic.id === "crimen-y-castigo" && "Deep raspy male voice, dramatic reading, slow pace, dark gothic ambiance, Spanish language"}
            {classic.id === "guerra-y-paz" && "Elegant documentary voiceover, epic narration tone, cinematic reading, clear pronunciation"}
            {classic.id === "el-maestro-y-margarita" && "Theatrical mischievous narrator voice, sarcastic undertone, fast-paced storytelling"}
          </code>
        </div>
      </div>
    </div>
  );
}
