import React, { useState, useEffect } from "react";

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
  }, [classic, activeScriptIndex]);

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
    teleprompterFormat += `Voz: ${classic.voiceProfile}`;

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
        <span className="sparkle">✍️</span> Guion para TikTok, Reels y Shorts
      </h3>

      {/* Tone Selection */}
      <div className="tone-selector">
        <span className="selector-label">Selecciona el enfoque narrativo del reel:</span>
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
          placeholder="Escribe el guion del reel aquí, línea por línea..."
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
          <strong>Configuración de Voz para Narración</strong>
        </div>
        <p className="voice-prompt-text">
          <><strong>Voz recomendada:</strong> {classic.voiceProfile}</>
        </p>
        <div className="prompt-copy-box">
          <code>{classic.voicePrompt}</code>
        </div>
      </div>
    </div>
  );
}
